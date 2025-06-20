import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"

// Use server-side environment variables (not exposed to client)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

interface ExtractedContext {
  primaryCategory: string
  detectedIssues: string[]
  visualIndicators: string[]
  urgencyLevel: "low" | "medium" | "high" | "critical"
  keywords: string[]
  deviceType?: string
  problemType?: string
}

interface RAGDocument {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  relevance_score: number
  icon_name?: string
  icon_description?: string
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType, userPrompt, systemPrompt, chatHistory = [], sessionId } = await request.json()

    if (!imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error: "画像データが必要です",
        },
        { status: 400 },
      )
    }

    // Validate required environment variables
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured")
      return NextResponse.json(
        {
          success: false,
          error: "API設定エラーが発生しました",
        },
        { status: 500 },
      )
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase configuration is missing")
      return NextResponse.json(
        {
          success: false,
          error: "データベース設定エラーが発生しました",
        },
        { status: 500 },
      )
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    const startTime = Date.now()

    console.log(`[Intelligent RAG] Starting analysis for session: ${sessionId}`)

    // Step 1: Extract context from image
    const contextExtractionPrompt = `
この画像を詳細に分析して、以下の情報をJSON形式で抽出してください：

{
  "primaryCategory": "主要カテゴリ（coffee_maker, maintenance, troubleshooting, safety, cleaning, parts, indicators, water_system, brewing, electrical, mechanical, general のいずれか）",
  "detectedIssues": ["検出された問題のリスト"],
  "visualIndicators": ["視覚的インジケーター（ランプ、表示、アイコンなど）"],
  "urgencyLevel": "緊急度（low, medium, high, critical のいずれか）",
  "keywords": ["関連キーワードのリスト"],
  "deviceType": "デバイスの種類",
  "problemType": "問題の種類"
}

画像に表示されているアイコン、ランプ、表示、エラーメッセージなどを詳しく観察してください。
特に以下の点に注目してください：
- 点灯しているランプや表示
- エラーアイコンや警告表示
- デバイスの状態や設定
- 異常な状況や問題の兆候

${userPrompt ? `ユーザーからの追加情報: ${userPrompt}` : ""}
`

    let extractedContext: ExtractedContext
    try {
      const contextResult = await model.generateContent([
        { text: contextExtractionPrompt },
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType || "image/jpeg",
          },
        },
      ])

      const contextText = contextResult.response.text()
      console.log(`[Context Extraction] Raw response: ${contextText}`)

      const jsonMatch = contextText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extractedContext = JSON.parse(jsonMatch[0])
        console.log(`[Context Extraction] Parsed context:`, extractedContext)
      } else {
        throw new Error("JSON not found in response")
      }
    } catch (parseError) {
      console.error("Context parsing error:", parseError)
      extractedContext = {
        primaryCategory: "general",
        detectedIssues: [],
        visualIndicators: [],
        urgencyLevel: "medium",
        keywords: userPrompt ? userPrompt.split(" ").filter((word) => word.length > 2) : [],
        deviceType: "unknown",
        problemType: "unknown",
      }
    }

    // Step 2: Search for relevant RAG documents
    const searchKeywords = [
      ...extractedContext.keywords,
      ...extractedContext.detectedIssues,
      ...extractedContext.visualIndicators,
      extractedContext.deviceType,
      extractedContext.problemType,
    ].filter(Boolean)

    let relevantDocuments: RAGDocument[] = []

    console.log(`[Document Search] Searching with keywords: ${searchKeywords.join(", ")}`)

    if (searchKeywords.length > 0) {
      // Try vector similarity search first
      try {
        const embedding = await generateTextEmbedding(searchKeywords.join(" "))
        if (embedding.length > 0) {
          const { data: vectorResults, error: vectorError } = await supabase.rpc("search_similar_documents", {
            query_embedding: embedding,
            match_threshold: 0.3,
            match_count: 5,
            filter_category: extractedContext.primaryCategory !== "general" ? extractedContext.primaryCategory : null,
          })

          if (!vectorError && vectorResults && vectorResults.length > 0) {
            relevantDocuments = vectorResults.map((doc: any) => ({
              ...doc,
              relevance_score: doc.similarity || 0.5,
            }))
            console.log(`[Vector Search] Found ${relevantDocuments.length} documents`)
          }
        }
      } catch (vectorSearchError) {
        console.error("Vector search error:", vectorSearchError)
      }

      // Fallback: Text-based search
      if (relevantDocuments.length === 0) {
        try {
          const { data: textResults, error: textError } = await supabase
            .from("rag_documents")
            .select("*")
            .or(
              searchKeywords
                .slice(0, 5) // Limit to first 5 keywords to avoid query complexity
                .map((keyword) => `title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
                .join(","),
            )
            .eq("is_active", true)
            .limit(5)

          if (!textError && textResults && textResults.length > 0) {
            relevantDocuments = textResults.map((doc) => ({
              ...doc,
              relevance_score: 0.4, // Default relevance for text search
            }))
            console.log(`[Text Search] Found ${relevantDocuments.length} documents`)
          }
        } catch (textSearchError) {
          console.error("Text search error:", textSearchError)
        }
      }

      // Additional category-based search
      if (relevantDocuments.length < 3 && extractedContext.primaryCategory !== "general") {
        try {
          const { data: categoryResults, error: categoryError } = await supabase
            .from("rag_documents")
            .select("*")
            .eq("category", extractedContext.primaryCategory)
            .eq("is_active", true)
            .limit(3)

          if (!categoryError && categoryResults) {
            for (const doc of categoryResults) {
              if (!relevantDocuments.find((existing) => existing.id === doc.id)) {
                relevantDocuments.push({
                  ...doc,
                  relevance_score: 0.3, // Lower relevance for category-only match
                })
              }
            }
            console.log(`[Category Search] Added ${categoryResults.length} additional documents`)
          }
        } catch (categorySearchError) {
          console.error("Category search error:", categorySearchError)
        }
      }
    }

    // Sort by relevance score
    relevantDocuments.sort((a, b) => b.relevance_score - a.relevance_score)
    relevantDocuments = relevantDocuments.slice(0, 5) // Top 5 most relevant

    // Step 3: Generate response using context and relevant documents
    let responsePrompt = systemPrompt || `あなたは専門的なトラブルシューティングアシスタントです。`

    responsePrompt += `

画像分析結果：
- デバイス: ${extractedContext.deviceType}
- カテゴリ: ${extractedContext.primaryCategory}
- 検出された問題: ${extractedContext.detectedIssues.join(", ") || "なし"}
- 視覚的インジケーター: ${extractedContext.visualIndicators.join(", ") || "なし"}
- 緊急度: ${extractedContext.urgencyLevel}
- キーワード: ${extractedContext.keywords.join(", ") || "なし"}

${userPrompt ? `ユーザーの質問: ${userPrompt}` : ""}
`

    if (relevantDocuments.length > 0) {
      responsePrompt += `
関連する知識ベース文書 (${relevantDocuments.length}件):
${relevantDocuments
  .map(
    (doc, index) => `
${index + 1}. ${doc.title} (関連度: ${(doc.relevance_score * 100).toFixed(1)}%)
カテゴリ: ${doc.category}
内容: ${doc.content}
${doc.icon_name ? `視覚的指標: ${doc.icon_name} - ${doc.icon_description}` : ""}
`,
  )
  .join("\n")}

上記の知識ベース文書を参考にして、`
    } else {
      responsePrompt += `
関連する知識ベース文書が見つかりませんでした。一般的な知識に基づいて、`
    }

    responsePrompt += `
画像の内容と検出された問題に基づいて、具体的で実用的な回答を提供してください。

回答の際は以下の点を考慮してください：
1. 安全性を最優先に考慮する
2. 段階的で分かりやすい手順を提供する
3. 必要に応じて専門家への相談を推奨する
4. 緊急度が高い場合は、それを明確に伝える
5. 視覚的インジケーターの意味を説明する

日本語で自然で親しみやすい口調で回答してください。
`

    // Build chat history
    const history = chatHistory.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.parts?.[0]?.text || msg.content || "" }],
    }))

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    })

    const finalResult = await chat.sendMessage([
      { text: responsePrompt },
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg",
        },
      },
    ])

    const processingTime = Date.now() - startTime
    const response = finalResult.response.text()

    console.log(`[Intelligent RAG] Analysis completed in ${processingTime}ms`)

    // Save chat session
    try {
      await supabase.from("chat_sessions").upsert({
        session_id: sessionId,
        messages: [
          ...(chatHistory || []),
          {
            role: "user",
            parts: [{ text: userPrompt }],
            timestamp: new Date().toISOString(),
            imageData: `data:${mimeType};base64,${imageBase64}`,
          },
          {
            role: "model",
            parts: [{ text: response }],
            timestamp: new Date().toISOString(),
            metadata: {
              extractedContext,
              relevantDocuments: relevantDocuments.length,
              processingTime,
            },
          },
        ],
        updated_at: new Date().toISOString(),
      })
    } catch (sessionError) {
      console.error("Failed to save chat session:", sessionError)
    }

    return NextResponse.json({
      success: true,
      response,
      extractedContext,
      relevantDocuments: relevantDocuments.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        relevance_score: doc.relevance_score,
        icon_name: doc.icon_name,
        icon_description: doc.icon_description,
      })),
      processingTimeMs: processingTime,
      metadata: {
        intelligentAnalysis: true,
        documentsFound: relevantDocuments.length,
        sessionId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Intelligent RAG analysis error:", error)

    let errorMessage = "インテリジェント分析中にエラーが発生しました"

    if (error instanceof Error) {
      if (error.message.includes("API_KEY")) {
        errorMessage = "API認証エラーが発生しました"
      } else if (error.message.includes("quota")) {
        errorMessage = "API使用量の上限に達しました"
      } else if (error.message.includes("safety")) {
        errorMessage = "安全性フィルターにより応答がブロックされました"
      } else if (error.message.includes("database") || error.message.includes("supabase")) {
        errorMessage = "データベース接続エラーが発生しました"
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    )
  }
}

async function generateTextEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" })
    const result = await model.embedContent(text)
    return result.embedding.values || []
  } catch (error) {
    console.error("Embedding generation error:", error)
    return []
  }
}
