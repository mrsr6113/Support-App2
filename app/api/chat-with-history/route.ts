import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { prompt, image, mimeType, systemPrompt, sessionId } = await request.json()

    if (!prompt) {
      return NextResponse.json({
        success: false,
        error: "プロンプトが必要です。",
      })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEYが設定されていません。",
      })
    }

    // Get or create chat session
    let chatSession
    if (sessionId) {
      try {
        // Check if the table exists first
        const { data: tableExists, error: tableError } = await supabaseAdmin.from("chat_sessions").select("id").limit(1)

        if (tableError && tableError.code === "42P01") {
          // Table doesn't exist, continue without session history
          console.warn("Chat sessions table does not exist. Continuing without session history.")
          chatSession = null
        } else {
          const { data: existingSession } = await supabaseAdmin
            .from("chat_sessions")
            .select("*")
            .eq("session_id", sessionId)
            .single()

          chatSession = existingSession
        }
      } catch (error) {
        console.warn("Failed to fetch chat session, continuing without history:", error)
        chatSession = null
      }
    }

    if (!chatSession && sessionId) {
      try {
        const newSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const { data: newSession, error } = await supabaseAdmin
          .from("chat_sessions")
          .insert({
            session_id: newSessionId,
            messages: [],
          })
          .select()
          .single()

        if (!error) {
          chatSession = newSession
        }
      } catch (error) {
        console.warn("Failed to create chat session, continuing without history:", error)
      }
    }

    // Get the language from headers or default to Japanese
    const language = request.headers.get("X-Language-Code") || "ja-JP"
    const languageCode = language.split("-")[0] || "ja"

    // Use provided system prompt or default language-specific prompt
    let finalSystemPrompt = systemPrompt
    if (!finalSystemPrompt) {
      if (languageCode === "en") {
        finalSystemPrompt =
          "Please respond naturally in English. For voice questions, aim for concise and clear answers."
      } else if (languageCode === "zh") {
        finalSystemPrompt = "请用中文自然回答。对于语音问题，请尽量简洁明了。"
      } else if (languageCode === "ko") {
        finalSystemPrompt =
          "한국어로 자연스럽게 대답해 주세요. 음성 질문의 경우 간결하고 이해하기 쉬운 답변을 해주세요."
      } else {
        finalSystemPrompt =
          "日本語で自然に回答してください。音声での質問の場合は、簡潔で分かりやすい回答を心がけてください。"
      }
    }

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // Start a chat with history
    const chat = model.startChat({
      history: chatSession?.messages || [],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
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

    // Prepare the message parts
    const messageParts: any[] = [
      {
        text: `${finalSystemPrompt}\n\nUser: ${prompt}`,
      },
    ]

    // Add image if provided
    if (image) {
      messageParts.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      })
    }

    // Send message and get response
    const result = await chat.sendMessage(messageParts)
    const response = await result.response
    const responseText = response.text()

    if (!responseText) {
      return NextResponse.json({
        success: false,
        error: "Gemini APIから有効な応答が得られませんでした。",
      })
    }

    // Update chat session with new messages (if session exists)
    if (chatSession) {
      try {
        const updatedMessages = [
          ...(chatSession.messages || []),
          {
            role: "user",
            parts: messageParts,
          },
          {
            role: "model",
            parts: [{ text: responseText }],
          },
        ]

        // Save updated session to Supabase
        await supabaseAdmin
          .from("chat_sessions")
          .update({
            messages: updatedMessages,
            updated_at: new Date().toISOString(),
          })
          .eq("id", chatSession.id)
      } catch (error) {
        console.warn("Failed to update chat session:", error)
      }
    }

    return NextResponse.json({
      success: true,
      response: responseText.trim(),
      sessionId: chatSession?.session_id || sessionId,
    })
  } catch (error) {
    console.error("Chat with history error:", error)
    return NextResponse.json({
      success: false,
      error: `チャット処理中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    })
  }
}
