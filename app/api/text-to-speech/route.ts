import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "テキストが必要です。" }, { status: 400 })
    }

    if (!process.env.GOOGLE_TTS_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_TTS_API_KEYが設定されていません。" }, { status: 500 })
    }

    // Google Text-to-Speech API呼び出し
    const ttsResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "ja-JP",
            name: "ja-JP-Standard-A",
          },
          audioConfig: {
            audioEncoding: "MP3",
          },
        }),
      },
    )

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text()
      console.error("TTS API error:", errorText)

      let errorMessage = "音声合成APIエラーが発生しました。"
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error?.message) {
          errorMessage = `TTS API: ${errorData.error.message}`
        }
      } catch {
        errorMessage = `TTS API: HTTP ${ttsResponse.status}`
      }

      return NextResponse.json({ error: errorMessage }, { status: ttsResponse.status })
    }

    const ttsData = await ttsResponse.json()

    if (!ttsData.audioContent) {
      return NextResponse.json({ error: "音声データが生成されませんでした。" }, { status: 500 })
    }

    // Base64デコードして音声データを返す
    const audioBuffer = Buffer.from(ttsData.audioContent, "base64")

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json(
      { error: `音声合成中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}` },
      { status: 500 },
    )
  }
}
