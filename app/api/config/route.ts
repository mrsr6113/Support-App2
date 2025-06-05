import { NextResponse } from "next/server"

export async function GET() {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY
  const hasTtsKey = !!process.env.GOOGLE_TTS_API_KEY

  let message = ""
  if (!hasGeminiKey && !hasTtsKey) {
    message = "GEMINI_API_KEYとGOOGLE_TTS_API_KEYの両方が設定されていません。"
  } else if (!hasGeminiKey) {
    message = "GEMINI_API_KEYが設定されていません。"
  } else if (!hasTtsKey) {
    message = "GOOGLE_TTS_API_KEYが設定されていません。"
  } else {
    message = "API設定が完了しています。"
  }

  return NextResponse.json({
    gemini: hasGeminiKey,
    tts: hasTtsKey,
    message,
  })
}
