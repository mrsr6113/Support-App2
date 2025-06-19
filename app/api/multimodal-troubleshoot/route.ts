import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Helper function to get image embedding from Google's multimodal embedding
async function getImageEmbedding(imageBase64: string, mimeType: string): Promise<number[] | null> {
  try {
    // Note: This is a conceptual implementation.
    // For actual 1408-dimension embeddings, you might need to use Vertex AI's
    // multimodal embedding endpoint or a specific Google model that outputs 1408 dimensions.

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // For now, we'll use Gemini's embedContent method
    // In production, you'd want to use a dedicated embedding model
    const result = await model.embedContent({
      content: {
        parts: [{ inlineData: { data: imageBase64, mimeType } }],
        role: "user",
      },
    })

    const embedding = result.embedding.values

    // Handle dimension mismatch - in production, ensure your embedding model outputs 1408 dimensions
    if (embedding.length !== 1408) {
      console.warn(`Warning: Embedding dimension is ${embedding.length}, expected 1408`)
      // Pad or truncate to 1408 dimensions (not ideal, but for demo purposes)
      if (embedding.length < 1408) {
        return [...embedding, ...Array(1408 - embedding.length).fill(0)]
      } else {
        return embedding.slice(0, 1408)
      }
    }

    return embedding
  } catch (error) {
    console.error("Error getting image embedding:", error)
    return null
  }
}

// Helper function to get prompts from database
async function getPromptFromDatabase(promptName: string, productCategory?: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("multimodal_prompts")
      .select("prompt")
      .eq("name", promptName)
      .eq("is_active", true)
      .or(`product_category.is.null,product_category.eq.${productCategory || "general"}`)
      .order("product_category", { ascending: false }) // Prefer category-specific prompts
      .limit(1)
      .single()

    if (error) {
      console.error("Error fetching prompt:", error)
      return null
    }

    return data.prompt
  } catch (error) {
    console.error("Error in getPromptFromDatabase:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType, productCategory, chatHistory, analysisType = "general" } = await request.json()

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ success: false, error: "Image data is required." }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured." }, { status: 500 })
    }

    // 1. Get analysis prompt from database
    const analysisPromptName =
      analysisType === "detailed"
        ? "detailed_indicator_analysis"
        : analysisType === "damage"
          ? "damage_assessment"
          : "general_image_analysis"

    const analysisPrompt = await getPromptFromDatabase(analysisPromptName, productCategory)

    if (!analysisPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not retrieve analysis prompt from database.",
        },
        { status: 500 },
      )
    }

    // 2. Perform initial image analysis with Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const analysisResult = await model.generateContent({
      contents: [
        {
          parts: [{ text: analysisPrompt }, { inlineData: { data: imageBase64, mimeType } }],
        },
      ],
    })

    const imageAnalysis = analysisResult.response.text()

    // 3. Vectorize the uploaded image for similarity search
    const imageEmbedding = await getImageEmbedding(imageBase64, mimeType)

    if (!imageEmbedding) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to vectorize image for similarity search.",
        },
        { status: 500 },
      )
    }

    // 4. Perform similarity search in Supabase
    const { data: similarDocs, error: dbError } = await supabaseAdmin.rpc("match_product_issues", {
      query_embedding: imageEmbedding,
      product_category_filter: productCategory || null,
      match_threshold: 0.6, // Lower threshold for more results
      match_count: 3,
    })

    if (dbError) {
      console.error("Supabase similarity search error:", dbError)
      return NextResponse.json(
        {
          success: false,
          error: "Database search failed.",
        },
        { status: 500 },
      )
    }

    // 5. Get response generation prompt
    const responsePrompt = await getPromptFromDatabase("troubleshooting_response", productCategory)

    if (!responsePrompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not retrieve response prompt from database.",
        },
        { status: 500 },
      )
    }

    // 6. Generate contextualized response
    let contextualInfo = ""
    if (similarDocs && similarDocs.length > 0) {
      contextualInfo = similarDocs
        .map(
          (doc, index) =>
            `Match ${index + 1} (${(doc.similarity * 100).toFixed(1)}% similarity):
        Issue: ${doc.icon_name} - ${doc.icon_description}
        Severity: ${doc.severity_level}
        Solution: ${doc.content}
        Tags: ${doc.tags?.join(", ") || "None"}`,
        )
        .join("\n\n")
    }

    const systemInstruction = `You are a technical troubleshooting assistant. 

Image Analysis Results:
${imageAnalysis}

${
  contextualInfo
    ? `Relevant Troubleshooting Information from Database:
${contextualInfo}`
    : "No similar issues found in database."
}

${responsePrompt}

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
      history: chatHistory || [],
    })

    const result = await chat.sendMessage(systemInstruction)
    const finalResponse = result.response.text()

    return NextResponse.json({
      success: true,
      response: finalResponse,
      imageAnalysis,
      matchedIssues: similarDocs || [],
      productCategory: productCategory || "general",
    })
  } catch (error) {
    console.error("Error in multimodal-troubleshoot API:", error)
    return NextResponse.json(
      {
        success: false,
        error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
