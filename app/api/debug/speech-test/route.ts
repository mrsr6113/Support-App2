import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { testType } = await request.json()

    const results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      userAgent: request.headers.get("user-agent"),
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      tests: {} as any,
    }

    // TTS API テスト（NEXT_PUBLIC_は削除）
    if (testType === "tts" || testType === "all") {
      const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_API_KEY || process.env.GOOGLE_API_KEY

      results.tests.tts = {
        hasApiKey: !!apiKey,
        apiKeySource: process.env.GOOGLE_TTS_API_KEY
          ? "server-tts"
          : process.env.GOOGLE_CLOUD_API_KEY
            ? "server-cloud"
            : process.env.GOOGLE_API_KEY
              ? "server-google"
              : "none",
      }

      if (apiKey) {
        try {
          const ttsResponse = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: { text: "テスト" },
              voice: {
                languageCode: "ja-JP",
                name: "ja-JP-Standard-A",
              },
              audioConfig: {
                audioEncoding: "MP3",
              },
            }),
          })

          results.tests.tts.apiTest = {
            status: ttsResponse.status,
            ok: ttsResponse.ok,
            statusText: ttsResponse.statusText,
          }

          if (ttsResponse.ok) {
            const data = await ttsResponse.json()
            results.tests.tts.apiTest.hasAudioContent = !!data.audioContent
          } else {
            const errorText = await ttsResponse.text()
            results.tests.tts.apiTest.error = errorText.substring(0, 500)
          }
        } catch (error) {
          results.tests.tts.apiTest = {
            error: error instanceof Error ? error.message : "Unknown error",
          }
        }
      }
    }

    // Gemini API テスト（NEXT_PUBLIC_は削除）
    if (testType === "gemini" || testType === "all") {
      const geminiKey = process.env.GEMINI_API_KEY

      results.tests.gemini = {
        hasApiKey: !!geminiKey,
        apiKeySource: process.env.GEMINI_API_KEY ? "server" : "none",
      }

      if (geminiKey) {
        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: "Hello" }],
                  },
                ],
              }),
            },
          )

          results.tests.gemini.apiTest = {
            status: geminiResponse.status,
            ok: geminiResponse.ok,
            statusText: geminiResponse.statusText,
          }

          if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            results.tests.gemini.apiTest.error = errorText.substring(0, 500)
          }
        } catch (error) {
          results.tests.gemini.apiTest = {
            error: error instanceof Error ? error.message : "Unknown error",
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error("Speech test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
