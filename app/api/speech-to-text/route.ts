import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "音声ファイルが必要です。" }, { status: 400 })
    }

    if (!process.env.GOOGLE_TTS_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_TTS_API_KEYが設定されていません。" }, { status: 500 })
    }

    // 音声ファイルをBase64に変換
    const bytes = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(bytes).toString("base64")

    // Google Cloud Speech-to-Text API呼び出し
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_TTS_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            encoding: "WEBM_OPUS",
            sampleRateHertz: 48000,
            languageCode: "ja-JP",
            alternativeLanguageCodes: ["en-US"],
            enableAutomaticPunctuation: true,
            enableWordTimeOffsets: false,
          },
          audio: {
            content: base64Audio,
          },
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("STT API error:", errorText)
      return NextResponse.json({ error: "音声認識APIエラー" }, { status: 500 })
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        success: true,
        transcript: "",
        message: "音声が認識されませんでした。",
      })
    }

    const transcript = data.results[0].alternatives[0].transcript || ""

    return NextResponse.json({
      success: true,
      transcript: transcript.trim(),
    })
  } catch (error) {
    console.error("STT error:", error)
    return NextResponse.json(
      {
        error: `音声認識中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      },
      { status: 500 },
    )
  }
}
