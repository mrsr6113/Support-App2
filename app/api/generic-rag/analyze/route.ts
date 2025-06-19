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

interface SimilarIssue {
  id: string
  title: string
  content: string
  icon_name?: string
  icon_description?: string
  category: string
  subcategory?: string
  issue_type: string
  severity_level: string
  urgency_level: string
  visual_indicators: string[]
  indicator_states: string[]
  difficulty_level: string
  estimated_time_minutes: number
  tools_required: string[]
  safety_warnings: string[]
  tags: string[]
  metadata: any
  similarity: number
}

// Generate image embeddings using Google's multimodal embedding
async function generateImageEmbedding(imageBase64: string, mimeType: string): Promise<number[] | null> {
  try {
    // Note: This is a conceptual implementation
    // In production, you would use Google Cloud Vertex AI multimodal embedding endpoint
    // For now, we'll use Gemini's embedding capability as a placeholder

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const result = await model.embedContent({
      content: {
        parts: [{ inlineData: { data: imageBase64, mimeType } }],
        role: "user",
      },
    })

    let embedding = result.embedding.values

    // Ensure exactly 1408 dimensions
    if (embedding.length !== 1408) {
      console.warn(`Embedding dimension mismatch: got ${embedding.length}, expected 1408`)

      if (embedding.length < 1408) {
        embedding = [...embedding, ...Array(1408 - embedding.length).fill(0)]
      } else {
        embedding = embedding.slice(0, 1408)
      }
    }

    return embedding
  } catch (error) {
    console.error("Error generating image embedding:", error)
    return null
  }
}

// Get analysis prompt from database
async function getAnalysisPrompt(analysisType: string, category?: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("analysis_prompts")
      .select("prompt_text")
      .eq("analysis_focus", analysisType)
      .eq("is_active", true)
      .or(`category.is.null,category.eq.${category || "general"}`)
      .order("priority", { ascending: false })
      .order("category", { ascending: false }) // Prefer category-specific prompts
      .limit(1)
      .single()

    if (error) {
      console.error("Error fetching analysis prompt:", error)
      return null
    }

    return data.prompt_text
  } catch (error) {
    console.error("Error in getAnalysisPrompt:", error)
    return null
  }
}

// Get response generation prompt
async function getResponsePrompt(): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("analysis_prompts")
      .select("prompt_text")
      .eq("prompt_type", "response")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error("Error fetching response prompt:", error)
      return null
    }

    return data.prompt_text
  } catch (error) {
    console.error("Error in getResponsePrompt:", error)
    return null
  }
}

// Log interaction for debugging and analytics
async function logInteraction(
  sessionId: string,
  interactionType: string,
  category?: string,
  imageMetadata?: any,
  analysisParameters?: any,
  similarIssuesFound?: number,
  responseGenerated?: boolean,
  processingTimeMs?: number,
  errorType?: string,
  errorMessage?: string,
  userAgent?: string,
  ipAddress?: string,
) {
  try {
    await supabaseAdmin.rpc("log_interaction", {
      p_session_id: sessionId,
      p_interaction_type: interactionType,
      p_category: category,
      p_image_metadata: imageMetadata ? JSON.stringify(imageMetadata) : null,
      p_analysis_parameters: analysisParameters ? JSON.stringify(analysisParameters) : null,
      p_similar_issues_found: similarIssuesFound || 0,
      p_response_generated: responseGenerated || false,
      p_processing_time_ms: processingTimeMs,
      p_error_type: errorType,
      p_error_message: errorMessage,
      p_user_agent: userAgent,
      p_ip_address: ipAddress,
    })
  } catch (error) {
    console.error("Failed to log interaction:", error)
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
      analysisType = "general",
      chatHistory = [],
      sessionId: requestSessionId,
      userAgent,
      ipAddress,
    }: AnalysisRequest = await request.json()

    sessionId = requestSessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    category = requestCategory

    // Validate required fields
    if (!imageBase64 || !mimeType) {
      await logInteraction(
        sessionId,
        "error",
        category,
        null,
        null,
        0,
        false,
        Date.now() - startTime,
        "validation_error",
        "Missing image data or MIME type",
        userAgent,
        ipAddress,
      )

      return NextResponse.json(
        {
          success: false,
          error: "Image data and MIME type are required.",
        },
        { status: 400 },
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      await logInteraction(
        sessionId,
        "error",
        category,
        null,
        null,
        0,
        false,
        Date.now() - startTime,
        "configuration_error",
        "GEMINI_API_KEY not configured",
        userAgent,
        ipAddress,
      )

      return NextResponse.json(
        {
          success: false,
          error: "AI service is not properly configured.",
        },
        { status: 500 },
      )
    }

    // Log image upload
    const imageMetadata = {
      mimeType,
      size: imageBase64.length,
      category,
      analysisType,
    }

    await logInteraction(
      sessionId,
      "image_upload",
      category,
      imageMetadata,
      { analysisType, category },
      0,
      false,
      null,
      null,
      null,
      userAgent,
      ipAddress,
    )

    // Step 1: Get analysis prompt
    const analysisPrompt = await getAnalysisPrompt(analysisType, category)
    if (!analysisPrompt) {
      await logInteraction(
        sessionId,
        "error",
        category,
        imageMetadata,
        null,
        0,
        false,
        Date.now() - startTime,
        "prompt_error",
        "Could not retrieve analysis prompt",
        userAgent,
        ipAddress,
      )

      return NextResponse.json(
        {
          success: false,
          error: "Could not retrieve analysis configuration from database.",
        },
        { status: 500 },
      )
    }

    // Step 2: Perform image analysis
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const analysisResult = await model.generateContent({
      contents: [
        {
          parts: [{ text: analysisPrompt }, { inlineData: { data: imageBase64, mimeType } }],
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

    // Step 3: Generate image embedding
    const imageEmbedding = await generateImageEmbedding(imageBase64, mimeType)
    if (!imageEmbedding) {
      await logInteraction(
        sessionId,
        "error",
        category,
        imageMetadata,
        { analysisType, category },
        0,
        false,
        Date.now() - startTime,
        "embedding_error",
        "Failed to generate image embedding",
        userAgent,
        ipAddress,
      )

      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate image embedding for similarity search.",
        },
        { status: 500 },
      )
    }

    // Step 4: Search for similar issues
    const { data: similarIssues, error: searchError } = await supabaseAdmin.rpc("search_similar_issues", {
      query_embedding: imageEmbedding,
      category_filter: category === "general" ? null : category,
      issue_type_filter: null,
      severity_filter: null,
      match_threshold: 0.5, // Lower threshold for more results
      match_count: 8,
    })

    if (searchError) {
      console.error("Similarity search error:", searchError)
      await logInteraction(
        sessionId,
        "error",
        category,
        imageMetadata,
        { analysisType, category },
        0,
        false,
        Date.now() - startTime,
        "search_error",
        searchError.message,
        userAgent,
        ipAddress,
      )

      return NextResponse.json(
        {
          success: false,
          error: "Failed to search for similar issues in knowledge base.",
        },
        { status: 500 },
      )
    }

    const typedSimilarIssues: SimilarIssue[] = similarIssues || []

    // Step 5: Generate contextualized response
    let contextualInfo = ""
    if (typedSimilarIssues.length > 0) {
      contextualInfo = typedSimilarIssues
        .slice(0, 5) // Limit to top 5 matches
        .map(
          (issue, index) =>
            `Similar Issue ${index + 1} (${(issue.similarity * 100).toFixed(1)}% match):
Title: ${issue.title}
Problem: ${issue.icon_name || "Unknown"} - ${issue.icon_description || "No description"}
Category: ${issue.category}${issue.subcategory ? ` > ${issue.subcategory}` : ""}
Issue Type: ${issue.issue_type}
Severity: ${issue.severity_level} | Urgency: ${issue.urgency_level}
Difficulty: ${issue.difficulty_level} | Est. Time: ${issue.estimated_time_minutes} min
Visual Indicators: ${issue.visual_indicators?.join(", ") || "None"}
Indicator States: ${issue.indicator_states?.join(", ") || "None"}
Tools Required: ${issue.tools_required?.join(", ") || "None"}
Safety Warnings: ${issue.safety_warnings?.join(", ") || "None"}
Solution: ${issue.content}
Tags: ${issue.tags?.join(", ") || "None"}`,
        )
        .join("\n\n")
    }

    // Get response generation prompt
    const responsePrompt = await getResponsePrompt()
    const systemInstruction = `${responsePrompt || "You are an expert troubleshooting assistant."}

Image Analysis Results:
${imageAnalysis}

${
  contextualInfo
    ? `Relevant Similar Issues from Knowledge Base:
${contextualInfo}`
    : "No similar issues found in knowledge base."
}

Based on the image analysis and any similar issues found, provide a helpful, structured response that prioritizes safety and provides clear, actionable guidance. Consider the chat history for context.`

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

    // Log successful analysis
    await logInteraction(
      sessionId,
      "analysis_complete",
      category,
      imageMetadata,
      { analysisType, category },
      typedSimilarIssues.length,
      true,
      processingTime,
      null,
      null,
      userAgent,
      ipAddress,
    )

    return NextResponse.json({
      success: true,
      response: finalResponse,
      imageAnalysis,
      similarIssues: typedSimilarIssues,
      category,
      analysisType,
      matchCount: typedSimilarIssues.length,
      processingTimeMs: processingTime,
      sessionId,
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    console.error("Error in generic RAG analysis:", error)

    await logInteraction(
      sessionId,
      "error",
      category,
      null,
      null,
      0,
      false,
      processingTime,
      "analysis_error",
      errorMessage,
    )

    return NextResponse.json(
      {
        success: false,
        error: `Analysis failed: ${errorMessage}`,
        processingTimeMs: processingTime,
        sessionId,
      },
      { status: 500 },
    )
  }
}
