import { type NextRequest, NextResponse } from "next/server"

function getVoiceName(languageCode: string): string {
  switch (languageCode) {
    case "en-US":
      return "en-US-Standard-B"
    case "en-GB":
      return "en-GB-Standard-B"
    case "zh-CN":
      return "zh-CN-Standard-B"
    case "ko-KR":
      return "ko-KR-Standard-B"
    case "ja-JP":
    default:
      return "ja-JP-Standard-A"
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "テキストが必要です。" }, { status: 400 })
    }

    // サーバーサイドの環境変数のみを使用（NEXT_PUBLIC_は削除）
    const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_API_KEY || process.env.GOOGLE_API_KEY

    if (!apiKey) {
      console.error("TTS API Key missing. Available env vars:", {
        GOOGLE_TTS_API_KEY: !!process.env.GOOGLE_TTS_API_KEY,
        GOOGLE_CLOUD_API_KEY: !!process.env.GOOGLE_CLOUD_API_KEY,
        GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
      })
      return NextResponse.json(
        {
          error: "Google Cloud Text-to-Speech APIキーが設定されていません。",
          solution: "環境変数 GOOGLE_TTS_API_KEY または GOOGLE_CLOUD_API_KEY を設定してください。",
          debug: {
            hasServerKey: !!process.env.GOOGLE_TTS_API_KEY,
            hasCloudKey: !!process.env.GOOGLE_CLOUD_API_KEY,
            hasGoogleKey: !!process.env.GOOGLE_API_KEY,
            environment: process.env.NODE_ENV || "unknown",
          },
        },
        { status: 500 },
      )
    }

    console.log("TTS API Request:", {
      textLength: text.length,
      languageCode: request.headers.get("X-Language-Code") || "ja-JP",
      environment: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      apiKeySource: process.env.GOOGLE_TTS_API_KEY
        ? "GOOGLE_TTS_API_KEY"
        : process.env.GOOGLE_CLOUD_API_KEY
          ? "GOOGLE_CLOUD_API_KEY"
          : "GOOGLE_API_KEY",
    })

    // Google Text-to-Speech API呼び出し
    const ttsResponse = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AI-Vision-Chat/1.0",
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: request.headers.get("X-Language-Code") || "ja-JP",
          name: getVoiceName(request.headers.get("X-Language-Code") || "ja-JP"),
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.0,
          pitch: 0.0,
          volumeGainDb: 0.0,
        },
      }),
    })

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text()
      console.error("TTS API error details:", {
        status: ttsResponse.status,
        statusText: ttsResponse.statusText,
        headers: Object.fromEntries(ttsResponse.headers.entries()),
        body: errorText,
        url: ttsResponse.url,
      })

      let errorMessage = "音声合成APIエラーが発生しました。"
      let solution = ""
      let debugInfo = {}

      try {
        const errorData = JSON.parse(errorText)

        if (errorData.error?.message) {
          const message = errorData.error.message
          errorMessage = `TTS API: ${message}`

          if (message.includes("Cloud Text-to-Speech API has not been used")) {
            solution =
              "Google Cloud ConsoleでCloud Text-to-Speech APIを有効化してください。https://console.cloud.google.com/apis/library/texttospeech.googleapis.com"
          } else if (message.includes("PERMISSION_DENIED")) {
            solution = "APIキーの権限を確認し、Text-to-Speech APIへのアクセス権限があることを確認してください。"
          } else if (message.includes("API_KEY_INVALID")) {
            solution = "APIキーが無効です。Google Cloud ConsoleでAPIキーを確認してください。"
          } else if (message.includes("INVALID_ARGUMENT")) {
            solution = "リクエストパラメータを確認してください。言語コードや音声名が正しいか確認してください。"
          } else if (message.includes("QUOTA_EXCEEDED")) {
            solution = "APIの使用量制限に達しました。Google Cloud Consoleで制限を確認してください。"
          }

          debugInfo = {
            code: errorData.error.code,
            status: errorData.error.status,
            details: errorData.error.details,
            message: message,
          }
        }
      } catch {
        errorMessage = `TTS API: HTTP ${ttsResponse.status} - ${ttsResponse.statusText}`

        if (ttsResponse.status === 403) {
          solution =
            "APIキーが無効か、Text-to-Speech APIが有効化されていません。Google Cloud Consoleで確認してください。"
        } else if (ttsResponse.status === 400) {
          solution = "リクエストが無効です。パラメータを確認してください。"
        } else if (ttsResponse.status === 429) {
          solution = "レート制限に達しました。しばらく待ってから再試行してください。"
        }

        debugInfo = {
          httpStatus: ttsResponse.status,
          statusText: ttsResponse.statusText,
          responseBody: errorText.substring(0, 500),
        }
      }

      return NextResponse.json(
        {
          error: errorMessage,
          solution: solution,
          debug: debugInfo,
          environment: process.env.NODE_ENV,
          troubleshooting: {
            step1: "Google Cloud ConsoleでText-to-Speech APIが有効化されているか確認",
            step2: "APIキーが正しく設定されているか確認（GOOGLE_TTS_API_KEY または GOOGLE_CLOUD_API_KEY）",
            step3: "APIキーにText-to-Speech APIの権限があるか確認",
            step4: "プロジェクトの請求が有効になっているか確認",
            note: "APIキー認証を使用しているため、プロジェクトIDは不要です",
          },
        },
        { status: ttsResponse.status },
      )
    }

    const ttsData = await ttsResponse.json()

    if (!ttsData.audioContent) {
      console.error("No audio content in TTS response:", ttsData)
      return NextResponse.json(
        {
          error: "音声データが生成されませんでした。",
          debug: { responseKeys: Object.keys(ttsData) },
          solution: "APIレスポンスにaudioContentが含まれていません。リクエストパラメータを確認してください。",
        },
        { status: 500 },
      )
    }

    const audioBuffer = Buffer.from(ttsData.audioContent, "base64")

    console.log("TTS Success:", {
      audioSize: audioBuffer.length,
      environment: process.env.NODE_ENV,
    })

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Language-Code",
      },
    })
  } catch (error) {
    console.error("TTS error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      environment: process.env.NODE_ENV,
    })

    return NextResponse.json(
      {
        error: `音声合成中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
        debug: {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          environment: process.env.NODE_ENV,
        },
        solution: "ネットワーク接続とAPIキー設定を確認してください。",
      },
      { status: 500 },
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Language-Code",
    },
  })
}
