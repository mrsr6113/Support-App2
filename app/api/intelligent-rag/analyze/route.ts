import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface AnalysisRequest {
  imageBase64: string
  mimeType: string
  userPrompt?: string
  chatHistory?: any[]
  sessionId?: string
  userAgent?: string
  ipAddress?: string
}

interface ExtractedContext {
  primaryCategory: string
  secondaryCategories: string[]
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
  icon_name?: string
  icon_description?: string
  category: string
  tags: string[]
  similarity: number
  relevance_score: number
}

// Enhanced logging function
async function logIntelligentAnalysis(
  sessionId: string,
  eventType: string,
  data?: any,
  error?: string,
  processingTime?: number,
) {
  try {
    const logEntry = {
      session_id: sessionId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      analysis_data: data ? JSON.stringify(data) : null,
      error_message: error,
      processing_time_ms: processingTime,
    }

    console.log(`[Intelligent RAG] ${eventType}:`, logEntry)

    await supabaseAdmin.from("intelligent_analysis_logs").insert(logEntry).select().single()
  } catch (logError) {
    console.error("Failed to log intelligent analysis event:", logError)
  }
}

// Step 1: Analyze image to extract context and identify what the user is looking at
async function extractImageContext(
  imageBase64: string,
  mimeType: string,
  userPrompt?: string,
): Promise<ExtractedContext> {
  try {
    console.log(`[Context Extraction] Analyzing image to extract context`)

    const contextExtractionPrompt = `Analyze this image and extract key contextual information. Focus on identifying:

1. DEVICE/PRODUCT TYPE: What specific device or product is shown?
2. PRIMARY CATEGORY: Main category (coffee_maker, printer, router, appliance, etc.)
3. VISUAL INDICATORS: Any lights, displays, error messages, warning symbols
4. DETECTED ISSUES: What problems or issues are visible?
5. URGENCY LEVEL: How urgent does this issue appear? (low/medium/high/critical)
6. KEYWORDS: Important terms that would help find relevant documentation

${userPrompt ? `User's question/context: "${userPrompt}"` : ""}

Respond in this exact JSON format:
{
  "primaryCategory": "category_name",
  "secondaryCategories": ["category1", "category2"],
  "detectedIssues": ["issue1", "issue2"],
  "visualIndicators": ["indicator1", "indicator2"],
  "urgencyLevel": "low|medium|high|critical",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "deviceType": "specific device name",
  "problemType": "type of problem"
}`

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const result = await model.generateContent({
      contents: [
        {
          parts: [{ text: contextExtractionPrompt }, { inlineData: { data: imageBase64, mimeType } }],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent JSON output
        topK: 16,
        topP: 0.8,
        maxOutputTokens: 512,
      },
    })

    const responseText = result.response.text()
    console.log(`[Context Extraction] Raw response:`, responseText)

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No JSON found in context extraction response")
    }

    const extractedContext: ExtractedContext = JSON.parse(jsonMatch[0])
    console.log(`[Context Extraction] Extracted context:`, extractedContext)

    return extractedContext
  } catch (error) {
    console.error(`[Context Extraction] Error:`, error)

    // Fallback context based on user prompt analysis
    const fallbackContext: ExtractedContext = {
      primaryCategory: "general",
      secondaryCategories: ["troubleshooting"],
      detectedIssues: ["unknown_issue"],
      visualIndicators: [],
      urgencyLevel: "medium",
      keywords: userPrompt ? userPrompt.split(" ").filter((word) => word.length > 3) : ["general"],
      deviceType: "unknown",
      problemType: "general_issue",
    }

    return fallbackContext
  }
}

// Step 2: Intelligent RAG document retrieval based on extracted context
async function retrieveRelevantDocuments(context: ExtractedContext, imageEmbedding?: number[]): Promise<RAGDocument[]> {
  try {
    console.log(`[Document Retrieval] Searching for relevant documents based on context`)

    const relevantDocs: RAGDocument[] = []

    // Strategy 1: Vector similarity search (if embedding available)
    if (imageEmbedding) {
      console.log(`[Document Retrieval] Performing vector similarity search`)

      const { data: vectorResults, error: vectorError } = await supabaseAdmin.rpc("search_similar_issues", {
        query_embedding: imageEmbedding,
        category_filter: context.primaryCategory === "general" ? null : context.primaryCategory,
        issue_type_filter: null,
        severity_filter: context.urgencyLevel === "critical" ? "critical" : null,
        match_threshold: 0.4, // Lower threshold for broader matches
        match_count: 5,
      })

      if (!vectorError && vectorResults) {
        relevantDocs.push(
          ...vectorResults.map((doc: any) => ({
            ...doc,
            relevance_score: doc.similarity * 0.6, // 60% weight for vector similarity
          })),
        )
      }
    }

    // Strategy 2: Keyword and category-based search
    console.log(`[Document Retrieval] Performing keyword and category search`)

    const searchTerms = [
      ...context.keywords,
      ...context.detectedIssues,
      ...context.visualIndicators,
      context.deviceType,
      context.problemType,
    ].filter(Boolean)

    const { data: keywordResults, error: keywordError } = await supabaseAdmin
      .from("rag_documents")
      .select("*")
      .or(`category.eq.${context.primaryCategory},category.in.(${context.secondaryCategories.join(",")})`)
      .is("is_active", true)
      .limit(10)

    if (!keywordError && keywordResults) {
      for (const doc of keywordResults) {
        // Calculate relevance score based on keyword matches
        let keywordScore = 0
        const docText =
          `${doc.title} ${doc.content} ${doc.icon_name} ${doc.icon_description} ${doc.tags?.join(" ")}`.toLowerCase()

        for (const term of searchTerms) {
          if (docText.includes(term.toLowerCase())) {
            keywordScore += 0.1
          }
        }

        // Category match bonus
        if (doc.category === context.primaryCategory) {
          keywordScore += 0.3
        } else if (context.secondaryCategories.includes(doc.category)) {
          keywordScore += 0.2
        }

        // Check if already added from vector search
        const existingDoc = relevantDocs.find((existing) => existing.id === doc.id)
        if (existingDoc) {
          // Combine scores
          existingDoc.relevance_score = Math.max(existingDoc.relevance_score, keywordScore)
        } else {
          relevantDocs.push({
            ...doc,
            similarity: 0,
            relevance_score: keywordScore,
          })
        }
      }
    }

    // Strategy 3: Urgency-based prioritization
    if (context.urgencyLevel === "critical" || context.urgencyLevel === "high") {
      console.log(`[Document Retrieval] Prioritizing urgent issue documents`)

      const { data: urgentDocs, error: urgentError } = await supabaseAdmin
        .from("rag_documents")
        .select("*")
        .contains("tags", ["urgent", "critical", "safety", "warning"])
        .is("is_active", true)
        .limit(3)

      if (!urgentError && urgentDocs) {
        for (const doc of urgentDocs) {
          const existingDoc = relevantDocs.find((existing) => existing.id === doc.id)
          if (existingDoc) {
            existingDoc.relevance_score += 0.4 // Urgency bonus
          } else {
            relevantDocs.push({
              ...doc,
              similarity: 0,
              relevance_score: 0.4,
            })
          }
        }
      }
    }

    // Sort by relevance score and return top matches
    const sortedDocs = relevantDocs.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 5) // Top 5 most relevant documents

    console.log(`[Document Retrieval] Found ${sortedDocs.length} relevant documents`)
    console.log(
      `[Document Retrieval] Top matches:`,
      sortedDocs.map((doc) => ({
        title: doc.title,
        category: doc.category,
        relevance_score: doc.relevance_score,
      })),
    )

    return sortedDocs
  } catch (error) {
    console.error(`[Document Retrieval] Error:`, error)
    return []
  }
}

// Step 3: Generate image embedding for vector search
async function generateImageEmbedding(imageBase64: string, mimeType: string): Promise<number[] | null> {
  try {
    console.log(`[Embedding] Generating image embedding`)

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

    // Ensure 1408 dimensions for pgvector compatibility
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
    console.error(`[Embedding] Error:`, error)
    return null
  }
}

// Step 4: Generate contextualized response using retrieved documents
async function generateContextualizedResponse(
  imageBase64: string,
  mimeType: string,
  context: ExtractedContext,
  relevantDocs: RAGDocument[],
  userPrompt?: string,
  chatHistory: any[] = [],
): Promise<string> {
  try {
    console.log(`[Response Generation] Generating contextualized response`)

    // Build context from relevant documents
    const documentContext =
      relevantDocs.length > 0
        ? relevantDocs
            .map(
              (doc, index) =>
                `Relevant Document ${index + 1} (Relevance: ${(doc.relevance_score * 100).toFixed(1)}%):
Title: ${doc.title}
Category: ${doc.category}
Problem/Solution: ${doc.content}
Visual Indicators: ${doc.icon_name ? `${doc.icon_name} - ${doc.icon_description}` : "N/A"}
Tags: ${doc.tags?.join(", ") || "None"}
`,
            )
            .join("\n")
        : "No specific documentation found for this issue."

    const systemPrompt = `You are an expert technical support assistant with access to a comprehensive knowledge base. 

CONTEXT ANALYSIS:
- Device Type: ${context.deviceType}
- Primary Category: ${context.primaryCategory}
- Detected Issues: ${context.detectedIssues.join(", ")}
- Visual Indicators: ${context.visualIndicators.join(", ")}
- Urgency Level: ${context.urgencyLevel}
- Keywords: ${context.keywords.join(", ")}

RELEVANT KNOWLEDGE BASE DOCUMENTS:
${documentContext}

USER'S QUESTION: ${userPrompt || "Please analyze this image and provide troubleshooting guidance."}

INSTRUCTIONS:
1. Analyze the image in detail, focusing on the detected issues and visual indicators
2. Use the relevant knowledge base documents to provide specific, actionable solutions
3. Prioritize safety if the urgency level is high or critical
4. Provide step-by-step instructions when appropriate
5. If no specific documentation matches, use your general knowledge but mention this limitation
6. Be concise but thorough in your response

Respond in a helpful, professional manner with clear action items.`

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

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

    const result = await chat.sendMessage([{ text: systemPrompt }, { inlineData: { data: imageBase64, mimeType } }])

    const response = result.response.text()
    console.log(`[Response Generation] Generated response length: ${response.length}`)

    return response
  } catch (error) {
    console.error(`[Response Generation] Error:`, error)
    return "申し訳ございませんが、分析中にエラーが発生しました。画像を再度アップロードしてお試しください。"
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let sessionId = ""

  try {
    const {
      imageBase64,
      mimeType,
      userPrompt,
      chatHistory = [],
      sessionId: requestSessionId,
      userAgent,
      ipAddress,
    }: AnalysisRequest = await request.json()

    sessionId = requestSessionId || `intelligent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log(`[Intelligent RAG] Starting intelligent analysis session ${sessionId}`)

    // Validate required fields
    if (!imageBase64 || !mimeType) {
      throw new Error("Image data and MIME type are required")
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured")
    }

    await logIntelligentAnalysis(sessionId, "analysis_started", {
      imageSize: imageBase64.length,
      mimeType,
      hasUserPrompt: !!userPrompt,
    })

    // Step 1: Extract context from image
    console.log(`[Intelligent RAG] Step 1: Extracting context from image`)
    const extractedContext = await extractImageContext(imageBase64, mimeType, userPrompt)

    await logIntelligentAnalysis(sessionId, "context_extracted", extractedContext)

    // Step 2: Generate image embedding for vector search
    console.log(`[Intelligent RAG] Step 2: Generating image embedding`)
    const imageEmbedding = await generateImageEmbedding(imageBase64, mimeType)

    // Step 3: Retrieve relevant documents intelligently
    console.log(`[Intelligent RAG] Step 3: Retrieving relevant documents`)
    const relevantDocuments = await retrieveRelevantDocuments(extractedContext, imageEmbedding || undefined)

    await logIntelligentAnalysis(sessionId, "documents_retrieved", {
      documentsFound: relevantDocuments.length,
      topRelevanceScore: relevantDocuments[0]?.relevance_score || 0,
      categories: [...new Set(relevantDocuments.map((doc) => doc.category))],
    })

    // Step 4: Generate contextualized response
    console.log(`[Intelligent RAG] Step 4: Generating contextualized response`)
    const finalResponse = await generateContextualizedResponse(
      imageBase64,
      mimeType,
      extractedContext,
      relevantDocuments,
      userPrompt,
      chatHistory,
    )

    const processingTime = Date.now() - startTime

    await logIntelligentAnalysis(
      sessionId,
      "analysis_completed",
      {
        extractedContext,
        documentsUsed: relevantDocuments.length,
        responseLength: finalResponse.length,
      },
      undefined,
      processingTime,
    )

    console.log(`[Intelligent RAG] Session ${sessionId} completed successfully in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      response: finalResponse,
      extractedContext,
      relevantDocuments: relevantDocuments.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        relevance_score: doc.relevance_score,
        similarity: doc.similarity,
      })),
      processingTimeMs: processingTime,
      sessionId,
      intelligentAnalysis: true,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    console.error(`[Intelligent RAG] Session ${sessionId} failed:`, errorMessage)

    await logIntelligentAnalysis(sessionId, "analysis_failed", null, errorMessage, processingTime)

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
