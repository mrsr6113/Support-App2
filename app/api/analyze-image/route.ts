import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { image, prompt, mimeType } = await request.json()

    if (!image || !prompt) {
      return NextResponse.json({
        success: false,
        error: "画像とプロンプトが必要です。",
      })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEYが設定されていません。環境変数を確認してください。",
      })
    }

    // Get the language from headers or default to Japanese
    const language = request.headers.get("X-Language-Code") || "ja-JP"
    const languageCode = language.split("-")[0] || "ja"

    // Determine system prompt based on language
    let systemPrompt = "日本語で簡潔に回答してください。"
    if (languageCode === "en") {
      systemPrompt = "Please respond concisely in English."
    } else if (languageCode === "zh") {
      systemPrompt = "请用中文简洁回答。"
    } else if (languageCode === "ko") {
      systemPrompt = "한국어로 간결하게 대답해 주세요."
    }

    // Gemini Vision API呼び出し
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
              parts: [
                {
                  text: `${prompt}\n\n${systemPrompt}`,
                },
                {
                  inline_data: {
                    mime_type: mimeType || "image/jpeg",
                    data: image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 32,
            topP: 0.8,
            maxOutputTokens: 1024,
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

    const analysis = candidate.content?.parts?.[0]?.text || "解析結果を取得できませんでした。"

    return NextResponse.json({
      success: true,
      analysis: analysis.trim(),
    })
  } catch (error) {
    console.error("Image analysis error:", error)
    return NextResponse.json({
      success: false,
      error: `画像解析中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    })
  }
}
