import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    // Get document statistics
    const { data: docStats, error: docError } = await supabaseAdmin
      .from("rag_documents")
      .select("category, issue_type, severity_level, difficulty_level")
      .eq("is_active", true)

    if (docError) {
      console.error("Error fetching document stats:", docError)
      return NextResponse.json(
        {
          success: false,
          error: docError.message,
        },
        { status: 500 },
      )
    }

    // Get interaction statistics
    const { data: interactionStats, error: interactionError } = await supabaseAdmin
      .from("interaction_logs")
      .select("interaction_type, category, timestamp")
      .gte("timestamp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    if (interactionError) {
      console.error("Error fetching interaction stats:", interactionError)
    }

    // Process statistics
    const stats = {
      totalDocuments: docStats?.length || 0,
      categoryCounts: {} as Record<string, number>,
      issueTypeCounts: {} as Record<string, number>,
      severityCounts: {} as Record<string, number>,
      difficultyCounts: {} as Record<string, number>,
      recentInteractions: interactionStats?.length || 0,
      interactionTypes: {} as Record<string, number>,
    }

    // Count by category, issue type, severity, and difficulty
    docStats?.forEach((doc) => {
      const category = doc.category || "general"
      const issueType = doc.issue_type || "general"
      const severity = doc.severity_level || "medium"
      const difficulty = doc.difficulty_level || "intermediate"

      stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1
      stats.issueTypeCounts[issueType] = (stats.issueTypeCounts[issueType] || 0) + 1
      stats.severityCounts[severity] = (stats.severityCounts[severity] || 0) + 1
      stats.difficultyCounts[difficulty] = (stats.difficultyCounts[difficulty] || 0) + 1
    })

    // Count interaction types
    interactionStats?.forEach((interaction) => {
      const type = interaction.interaction_type
      stats.interactionTypes[type] = (stats.interactionTypes[type] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error("Stats fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch system statistics",
        stats: null,
      },
      { status: 500 },
    )
  }
}
