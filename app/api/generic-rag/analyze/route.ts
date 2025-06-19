import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface AnalysisRequest {
  imageBase64: string
  mimeType: string
  category?: string
  analysisType?: string
  chatHistory?: any[]
  sessionId?: string
  userAgent?: string
  ipAddress?: string
}

// Enhanced logging function
async function logAnalysisEvent(
  sessionId: string,
  eventType: string,
  analysisData?: any,
  error?: string,
  processingTime?: number,
) {
  try {
    const logEntry = {
      session_id: sessionId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      analysis_data: analysisData ? JSON.stringify(analysisData) : null,
      error_message: error,
      processing_time_ms: processingTime,
    }

    console.log(`[Analysis] ${eventType}:`, logEntry)

    // Store in database for analytics
    await supabaseAdmin.from("analysis_logs").insert(logEntry).select().single()
  } catch (logError) {
    console.error("Failed to log analysis event:", logError)
  }
}

// Get analysis configuration with fallback
async function getAnalysisConfiguration(analysisType: string, category?: string) {
  try {
    console.log(`[Analysis Config] Fetching configuration for type: ${analysisType}, category: ${category}`)

    // Try to get from database first
    const { data: prompts, error: promptError } = await supabaseAdmin
      .from("analysis_prompts")
      .select("*")
      .eq("analysis_focus", analysisType)
      .eq("is_active", true)
      .order("priority", { ascending: false })

    if (promptError) {
      console.warn(`[Analysis Config] Database error: ${promptError.message}`)
    } else if (prompts && prompts.length > 0) {
      console.log(`[Analysis Config] Found ${prompts.length} prompts in database`)
      return {
        analysisPrompt: prompts[0].prompt_text,
        source: "database",
      }
    }

    // Fallback to hardcoded prompts
    console.log(`[Analysis Config] Using fallback configuration`)

    const fallbackPrompts = {
      coffee_maker_expert: `あなたはコーヒーメーカーの専門技術者です。画像を詳細に分析し、以下の点に注目してください：

1. インジケーターランプの状態（点灯、点滅、消灯）
2. ランプの色（赤、緑、青、オレンジなど）
3. 表示されているアイコンやシンボル
4. 機器の全体的な状態

特に以下の問題を特定してください：
- カス受け関連の問題
- 給水タンクの問題
- 抽出ユニットの問題
- メンテナンス要求
- エラー状態

具体的で実用的な解決策を提供してください。`,

      general_assistant: `画像を詳細に分析し、以下の情報を提供してください：

1. 画像に写っている主要な物体や要素
2. 注目すべき特徴や状態
3. 問題や異常が見られる場合はその詳細
4. 推奨される対処法や次のステップ

分析は正確で具体的に行い、ユーザーにとって有用な情報を提供してください。`,

      technical_support: `技術サポートの専門家として画像を分析してください：

1. 機器の状態と動作状況
2. エラーインジケーターや警告表示
3. 物理的な問題や異常
4. メンテナンスの必要性

技術的に正確で、段階的な解決手順を提供してください。`,
    }

    const prompt = fallbackPrompts[analysisType as keyof typeof fallbackPrompts] || fallbackPrompts.general_assistant

    return {
      analysisPrompt: prompt,
      source: "fallback",
    }
  } catch (error) {
    console.error(`[Analysis Config] Error: ${error}`)
    return {
      analysisPrompt: "画像を分析し、詳細な説明を提供してください。",
      source: "default",
    }
  }
}

// Generate image embedding for similarity search
async function generateImageEmbedding(imageBase64: string, mimeType: string): Promise<number[] | null> {
  try {
    console.log(`[Embedding] Generating embedding for similarity search`)

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const result = await model.embedContent({
      content: {
        parts: [{ inlineData: { data: imageBase64, mimeType } }],
        role: "user",
      },
    })

    let embedding = result.embedding.values

    if (!embedding || embedding.length === 0) {
      throw new Error("Empty embedding returned")
    }

    // Ensure 1408 dimensions
    const targetDimensions = 1408
    if (embedding.length !== targetDimensions) {
      if (embedding.length < targetDimensions) {
        embedding = [...embedding, ...Array(targetDimensions - embedding.length).fill(0)]
      } else {
        embedding = embedding.slice(0, targetDimensions)
      }
    }

    console.log(`[Embedding] Generated embedding with ${embedding.length} dimensions`)
    return embedding
  } catch (error) {
    console.error(`[Embedding] Error: ${error}`)
    return null
  }
}

// Search for similar issues in the knowledge base
async function searchSimilarIssues(embedding: number[], category?: string) {
  try {
    console.log(`[Similarity Search] Searching for similar issues, category: ${category}`)

    const { data: similarIssues, error: searchError } = await supabaseAdmin.rpc("search_similar_issues", {
      query_embedding: embedding,
      category_filter: category === "general" ? null : category,
      issue_type_filter: null,
      severity_filter: null,
      match_threshold: 0.5,
      match_count: 5,
    })

    if (searchError) {
      console.error(`[Similarity Search] Database error: ${searchError.message}`)
      return []
    }

    console.log(`[Similarity Search] Found ${similarIssues?.length || 0} similar issues`)
    return similarIssues || []
  } catch (error) {
    console.error(`[Similarity Search] Error: ${error}`)
    return []
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let sessionId = ""
  let category = "general"

  try {
    const {
      imageBase64,
      mimeType,
      category: requestCategory = "general",
      analysisType = "coffee_maker_expert",
      chatHistory = [],
      sessionId: requestSessionId,
      userAgent,
      ipAddress,
    }: AnalysisRequest = await request.json()

    sessionId = requestSessionId || `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    category = requestCategory

    console.log(`[Analysis] Starting session ${sessionId}`)

    // Validate required fields
    if (!imageBase64 || !mimeType) {
      throw new Error("Image data and MIME type are required")
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured")
    }

    await logAnalysisEvent(sessionId, "analysis_started", {
      category,
      analysisType,
      imageSize: imageBase64.length,
      mimeType,
    })

    // Get analysis configuration
    const config = await getAnalysisConfiguration(analysisType, category)
    console.log(`[Analysis] Using ${config.source} configuration`)

    // Perform image analysis
    console.log(`[Analysis] Analyzing image with Gemini`)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const analysisResult = await model.generateContent({
      contents: [
        {
          parts: [{ text: config.analysisPrompt }, { inlineData: { data: imageBase64, mimeType } }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 32,
        topP: 0.8,
        maxOutputTokens: 1024,
      },
    })

    const imageAnalysis = analysisResult.response.text()
    console.log(`[Analysis] Image analysis completed`)

    // Generate embedding for similarity search
    const imageEmbedding = await generateImageEmbedding(imageBase64, mimeType)
    let similarIssues = []

    if (imageEmbedding) {
      similarIssues = await searchSimilarIssues(imageEmbedding, category)
    }

    // Build context from similar issues
    let contextualInfo = ""
    if (similarIssues.length > 0) {
      contextualInfo = similarIssues
        .slice(0, 3)
        .map(
          (issue: any, index: number) =>
            `Similar Issue ${index + 1} (${(issue.similarity * 100).toFixed(1)}% match):
Title: ${issue.title}
Category: ${issue.category}
Solution: ${issue.content}`,
        )
        .join("\n\n")
    }

    // Generate final response
    const systemInstruction = `Based on the image analysis and any similar issues found, provide a helpful, structured response.

Image Analysis Results:
${imageAnalysis}

${
  contextualInfo
    ? `Relevant Similar Issues from Knowledge Base:
${contextualInfo}`
    : "No similar issues found in knowledge base."
}

Provide a clear, actionable response that prioritizes safety and gives specific guidance.`

    const chat = model.startChat({
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      history: chatHistory,
    })

    const result = await chat.sendMessage(systemInstruction)
    const finalResponse = result.response.text()

    const processingTime = Date.now() - startTime

    await logAnalysisEvent(
      sessionId,
      "analysis_completed",
      {
        category,
        analysisType,
        similarIssuesFound: similarIssues.length,
        configSource: config.source,
      },
      undefined,
      processingTime,
    )

    console.log(`[Analysis] Session ${sessionId} completed successfully in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      response: finalResponse,
      imageAnalysis,
      similarIssues,
      category,
      analysisType,
      matchCount: similarIssues.length,
      processingTimeMs: processingTime,
      sessionId,
      configSource: config.source,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    console.error(`[Analysis] Session ${sessionId} failed:`, errorMessage)

    await logAnalysisEvent(sessionId, "analysis_failed", { category }, errorMessage, processingTime)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        processingTimeMs: processingTime,
        sessionId,
      },
      { status: 500 },
    )
  }
}
