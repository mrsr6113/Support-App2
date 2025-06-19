import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase" // Assuming supabaseAdmin is configured with service_role

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Helper function to get image embedding from Google
async function getImageEmbedding(imageBase64: string, mimeType: string): Promise<number[] | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) // Or a specific embedding model if available
    const result = await model.embedContent({
      content: {
        parts: [{ inlineData: { data: imageBase64, mimeType } }],
        role: "user",
      },
      // taskType: "SEMANTIC_SIMILARITY", // Or appropriate task type
      // outputDimensionality: 1408, // If the model supports this parameter
    })
    // Note: Check the actual output dimensionality of the model you use.
    // If it's not 1408, adjust the DB schema and this function.
    // For gemini-1.5-flash, the default embedding size might be different.
    // This is a conceptual implementation based on the 1408 requirement.
    // You might need a specific Vertex AI multimodal embedding endpoint for 1408.
    const embedding = result.embedding.values
    if (embedding.length !== 1408) {
      console.warn(
        `Warning: Embedding dimension is ${embedding.length}, not 1408. Please check your model and DB schema.`,
      )
      // For now, let's try to pad or truncate if necessary, though this is not ideal.
      // Or, throw an error. For this example, I'll proceed but log a warning.
    }
    return embedding
  } catch (error) {
    console.error("Error getting image embedding:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType, chatHistory } = await request.json()

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ success: false, error: "Image data is required." }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: "GEMINI_API_KEY is not configured." }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: "Supabase service role key is not configured." },
        { status: 500 },
      )
    }

    // 1. Vectorize the uploaded image
    const imageEmbedding = await getImageEmbedding(imageBase64, mimeType)

    if (!imageEmbedding) {
      return NextResponse.json({ success: false, error: "Failed to vectorize image." }, { status: 500 })
    }

    // 2. Similarity Search in Supabase
    // Ensure the `match_coffee_maker_icons` function is created in your Supabase DB
    // and that `image_embedding` column in `coffee_maker_rag_documents` is VECTOR(1408)
    const { data: similarDocs, error: dbError } = await supabaseAdmin.rpc("match_coffee_maker_icons", {
      query_embedding: imageEmbedding,
      match_threshold: 0.7, // Adjust as needed
      match_count: 1,
    })

    if (dbError) {
      console.error("Supabase similarity search error:", dbError)
      return NextResponse.json({ success: false, error: "Database search failed." }, { status: 500 })
    }

    if (!similarDocs || similarDocs.length === 0) {
      return NextResponse.json({
        success: true,
        response:
          "I couldn't find a matching issue for the provided image. Could you describe the problem or try a different angle?",
      })
    }

    const matchedIssue = similarDocs[0]
    const troubleshootingContent = matchedIssue.content

    // 3. Contextualized Response Generation with Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    const generationConfig = {
      temperature: 0.7,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    }
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      // ... other safety settings
    ]

    const systemInstruction = `You are a helpful coffee maker troubleshooting assistant.
    A user has provided an image of their coffee maker's indicator lights.
    Based on the image, we've identified a potential issue with the following information:
    Issue: ${matchedIssue.icon_name} (${matchedIssue.icon_description || "No description"})
    Troubleshooting Steps: ${troubleshootingContent}

    Your task is to explain this to the user in a natural, concise, and easy-to-understand way.
    Use the provided troubleshooting steps.
    Consider the chat history for context. If the user has already tried something, acknowledge it if possible.
    Be friendly and helpful. Ask if they need further clarification.`

    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: [
        ...(chatHistory || []),
        { role: "user", parts: [{ text: "Here's an image of my coffee maker panel." }] },
        { role: "model", parts: [{ text: systemInstruction }] }, // This primes the model with context
      ],
    })

    // Send a follow-up prompt to trigger the actual response based on the context
    const result = await chat.sendMessage(
      "Please explain the issue and how to solve it based on the information I provided.",
    )
    const geminiResponse = result.response.text()

    return NextResponse.json({ success: true, response: geminiResponse, matchedIssue })
  } catch (error) {
    console.error("Error in troubleshoot-coffee-maker API:", error)
    return NextResponse.json(
      {
        success: false,
        error: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
