import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    console.log("[Debug] Checking RAG system status...")

    // Check database connection
    const { data: connectionTest, error: connectionError } = await supabaseAdmin
      .from("rag_documents")
      .select("count")
      .limit(1)

    if (connectionError) {
      console.error("[Debug] Database connection failed:", connectionError)
      return NextResponse.json({
        success: false,
        error: "Database connection failed",
        details: connectionError.message,
      })
    }

    // Get RAG documents statistics
    const { data: ragStats, error: ragError } = await supabaseAdmin.rpc("get_rag_statistics")

    if (ragError) {
      console.warn("[Debug] Could not get RAG statistics:", ragError.message)
    }

    // Check for documents with missing embeddings
    const { data: missingEmbeddings, error: embeddingError } = await supabaseAdmin
      .from("rag_documents")
      .select("id, title, created_at")
      .is("image_embedding", null)
      .eq("is_active", true)

    if (embeddingError) {
      console.error("[Debug] Error checking embeddings:", embeddingError)
    }

    // Check analysis prompts
    const { data: analysisPrompts, error: promptError } = await supabaseAdmin
      .from("analysis_prompts")
      .select("analysis_focus, is_active")
      .eq("is_active", true)

    if (promptError) {
      console.warn("[Debug] Could not get analysis prompts:", promptError.message)
    }

    // Check recent registration logs
    const { data: recentLogs, error: logError } = await supabaseAdmin
      .from("registration_logs")
      .select("event_type, timestamp, error_message")
      .order("timestamp", { ascending: false })
      .limit(10)

    if (logError) {
      console.warn("[Debug] Could not get recent logs:", logError.message)
    }

    const status = {
      database: {
        connected: !connectionError,
        error: connectionError?.message,
      },
      ragDocuments: {
        total: ragStats?.total_documents || 0,
        withEmbeddings: ragStats?.documents_with_embeddings || 0,
        withoutEmbeddings: missingEmbeddings?.length || 0,
        missingEmbeddingsList: missingEmbeddings?.slice(0, 5) || [],
      },
      analysisPrompts: {
        available: analysisPrompts?.length || 0,
        prompts: analysisPrompts || [],
      },
      recentActivity: {
        logs: recentLogs || [],
      },
      apiConfiguration: {
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    }

    console.log("[Debug] RAG system status:", status)

    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Debug] Error checking RAG status:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check RAG system status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
