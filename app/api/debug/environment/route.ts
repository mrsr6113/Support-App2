import { NextResponse } from "next/server"

export async function GET() {
  try {
    const envInfo = {
      // 環境情報
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,

      // API キーの存在確認（値は表示しない、NEXT_PUBLIC_は削除）
      hasGoogleTTSKey: !!process.env.GOOGLE_TTS_API_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,

      // Supabase設定
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,

      // その他の環境変数
      hasGoogleCloudApiKey: !!process.env.GOOGLE_CLOUD_API_KEY,
      hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,

      // タイムスタンプ
      timestamp: new Date().toISOString(),

      // プロセス情報
      platform: process.platform,
      nodeVersion: process.version,
    }

    return NextResponse.json({
      success: true,
      environment: envInfo,
      message: "Environment check completed",
    })
  } catch (error) {
    console.error("Environment check error:", error)
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
