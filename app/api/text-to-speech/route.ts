import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "有効なテキストが必要です。" }, { status: 400 })
    }

    if (!process.env.GOOGLE_TTS_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_TTS_API_KEYが設定されていません。" }, { status: 500 })
    }

    // テキストが長すぎる場合は切り詰める
    const truncatedText = text.length > 5000 ? text.substring(0, 5000) + "..." : text

    // Google Cloud Text-to-Speech API呼び出し
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: truncatedText },
          voice: {
            languageCode: "ja-JP",
            name: "ja-JP-Neural2-B",
            ssmlGender: "FEMALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0,
          },
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("TTS API error:", errorText)

      let errorMessage = "TTS APIエラーが発生しました。"
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.message) {
          errorMessage = `TTS API: ${errorData.error.message}`
        }
      } catch {
        errorMessage = `TTS API: HTTP ${response.status}`
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    const data = await response.json()

    if (!data.audioContent) {
      return NextResponse.json({ error: "音声データが生成されませんでした。" }, { status: 500 })
    }

    // Base64デコードしてバイナリデータに変換
    const audioBuffer = Buffer.from(data.audioContent, "base64")

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json(
      {
        error: `音声合成中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      },
      { status: 500 },
    )
  }
}
