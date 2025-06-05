import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt, image, mimeType } = await request.json()

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

    // リクエストボディを構築
    const parts: any[] = [
      {
        text: `${prompt}\n\n日本語で自然に回答してください。音声での質問の場合は、簡潔で分かりやすい回答を心がけてください。`,
      },
    ]

    // 画像が提供されている場合は追加
    if (image) {
      parts.push({
        inline_data: {
          mime_type: mimeType || "image/jpeg",
          data: image,
        },
      })
    }

    // Gemini API呼び出し
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts,
            },
          ],
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
        }),
      },
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error("Gemini API error:", errorText)

      let errorMessage = "Gemini APIエラーが発生しました。"
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.message) {
          errorMessage = `Gemini API: ${errorData.error.message}`
        }
      } catch {
        errorMessage = `Gemini API: HTTP ${geminiResponse.status}`
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
      })
    }

    const geminiData = await geminiResponse.json()

    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Gemini APIから有効な応答が得られませんでした。",
      })
    }

    const candidate = geminiData.candidates[0]

    if (candidate.finishReason === "SAFETY") {
      return NextResponse.json({
        success: false,
        error: "安全性フィルターにより応答がブロックされました。",
      })
    }

    const response = candidate.content?.parts?.[0]?.text || "応答を取得できませんでした。"

    return NextResponse.json({
      success: true,
      response: response.trim(),
    })
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json({
      success: false,
      error: `チャット処理中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    })
  }
}
