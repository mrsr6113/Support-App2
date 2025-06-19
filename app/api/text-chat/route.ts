import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Use server-side environment variable (not exposed to client)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { prompt, chatHistory = [] } = await request.json()

    if (!prompt?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "プロンプトが必要です",
        },
        { status: 400 },
      )
    }

    // Validate API key is available
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // Build conversation history
    const history = chatHistory.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }))

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 1000,
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

    const startTime = Date.now()
    const result = await chat.sendMessage(prompt)
    const processingTime = Date.now() - startTime

    const response = result.response.text()

    return NextResponse.json({
      success: true,
      response,
      processingTimeMs: processingTime,
      metadata: {
        textOnly: true,
        model: "gemini-1.5-flash",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Text chat error:", error)

    let errorMessage = "チャット処理中にエラーが発生しました"

    if (error instanceof Error) {
      // Handle specific API errors
      if (error.message.includes("API_KEY")) {
        errorMessage = "API認証エラーが発生しました"
      } else if (error.message.includes("quota")) {
        errorMessage = "API使用量の上限に達しました"
      } else if (error.message.includes("safety")) {
        errorMessage = "安全性フィルターにより応答がブロックされました"
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
