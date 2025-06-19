import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Helper function to generate image embeddings using Google's multimodal embedding
async function generateImageEmbedding(imageBase64: string, mimeType: string): Promise<number[] | null> {
  try {
    // Note: This is a conceptual implementation for Google's multimodal embedding
    // In production, you would use the actual Google Cloud Vertex AI multimodal embedding endpoint
    // For now, we'll use Gemini's embedding capability as a placeholder

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const result = await model.embedContent({
      content: {
        parts: [{ inlineData: { data: imageBase64, mimeType } }],
        role: "user",
      },
    })

    let embedding = result.embedding.values

    // Ensure we have exactly 1408 dimensions as required
    if (embedding.length !== 1408) {
      console.warn(`Embedding dimension mismatch: got ${embedding.length}, expected 1408`)

      // Pad with zeros if too short, truncate if too long
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

// Helper function to get analysis prompt from database
async function getAnalysisPrompt(analysisType: string, productType?: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("multimodal_analysis_prompts")
      .select("prompt_text")
      .eq("analysis_type", analysisType)
      .eq("is_active", true)
      .or(`product_type.is.null,product_type.eq.${productType || "general"}`)
      .order("product_type", { ascending: false }) // Prefer product-specific prompts
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

export async function POST(request: NextRequest) {
  try {
    const {
      imageBase64,
      mimeType,
      productType = "general",
      analysisType = "general",
      chatHistory = [],
    } = await request.json()

    if (!imageBase64 || !mimeType) {
      return NextResponse.json(
        {
          success: false,
          error: "Image data and MIME type are required.",
        },
        { status: 400 },
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY is not configured.",
        },
        { status: 500 },
      )
    }

    // Step 1: Get analysis prompt from database
    const analysisPrompt = await getAnalysisPrompt(analysisType, productType)
    if (!analysisPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not retrieve analysis prompt from database.",
        },
        { status: 500 },
      )
    }

    // Step 2: Perform initial image analysis
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

    // Step 3: Generate image embedding for similarity search
    const imageEmbedding = await generateImageEmbedding(imageBase64, mimeType)
    if (!imageEmbedding) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate image embedding for similarity search.",
        },
        { status: 500 },
      )
    }

    // Step 4: Perform similarity search in existing rag_documents table
    const { data: similarIssues, error: searchError } = await supabaseAdmin.rpc("match_visual_issues", {
      query_embedding: imageEmbedding,
      product_type_filter: productType === "general" ? null : productType,
      match_threshold: 0.6, // Lowered threshold for more results
      match_count: 5,
    })

    if (searchError) {
      console.error("Similarity search error:", searchError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to search for similar issues in database.",
        },
        { status: 500 },
      )
    }

    // Step 5: Generate contextualized response
    let contextualInfo = ""
    if (similarIssues && similarIssues.length > 0) {
      contextualInfo = similarIssues
        .map(
          (issue, index) =>
            `Similar Issue ${index + 1} (${(issue.similarity * 100).toFixed(1)}% match):
        Title: ${issue.title || "Untitled"}
        Problem: ${issue.icon_name || "Unknown"} - ${issue.icon_description || "No description"}
        Severity: ${issue.severity_level || "Unknown"}
        Solution: ${issue.content}
        Visual Indicators: ${issue.visual_indicators?.join(", ") || "None"}
        Tags: ${issue.tags?.join(", ") || "None"}`,
        )
        .join("\n\n")
    }

    // Get response generation prompt
    const responsePrompt = await getAnalysisPrompt("diagnostic", productType)
    const finalPrompt =
      responsePrompt ||
      `Based on the image analysis and similar issues found, provide a structured troubleshooting response with:
    🔍 **Issue Identified**: Brief description
    ⚠️ **Severity**: Critical/High/Medium/Low  
    🛠️ **Solution Steps**: Numbered, actionable steps
    💡 **Prevention**: How to avoid this issue
    📞 **Next Steps**: When to seek additional help`

    const systemInstruction = `You are an expert technical troubleshooting assistant.

    Image Analysis Results:
    ${imageAnalysis}

    ${
      contextualInfo
        ? `Relevant Similar Issues from Database:
    ${contextualInfo}`
        : "No similar issues found in database."
    }

    ${finalPrompt}

    Consider the chat history for context and provide a helpful, structured response.`

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

    return NextResponse.json({
      success: true,
      response: finalResponse,
      imageAnalysis,
      similarIssues: similarIssues || [],
      productType,
      analysisType,
      matchCount: similarIssues?.length || 0,
    })
  } catch (error) {
    console.error("Error in multimodal RAG analysis:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
