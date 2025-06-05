import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check for required environment variables
    const geminiKey = process.env.GEMINI_API_KEY
    const ttsKey = process.env.GOOGLE_TTS_API_KEY

    const hasGemini = !!geminiKey
    const hasTTS = !!ttsKey

    let message = ""
    if (hasGemini && hasTTS) {
      message = "✅ すべてのAPI設定が完了しています。"
    } else {
      const missing = []
      if (!hasGemini) missing.push("GEMINI_API_KEY")
      if (!hasTTS) missing.push("GOOGLE_TTS_API_KEY")
      message = `⚠️ 以下の環境変数が設定されていません: ${missing.join(", ")}`
    }

    return NextResponse.json({
      gemini: hasGemini,
      tts: hasTTS,
      message,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Config check error:", error)
    return NextResponse.json(
      {
        gemini: false,
        tts: false,
        message: "❌ API設定の確認中にエラーが発生しました。",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
