import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("analysis_prompts")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("analysis_focus", { ascending: true })

    if (error) {
      console.error("Error fetching analysis prompts:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          prompts: [],
        },
        { status: 500 },
      )
    }

    const prompts = (data || []).map((prompt) => ({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      analysisType: prompt.analysis_focus,
      promptType: prompt.prompt_type,
      category: prompt.category,
      priority: prompt.priority,
      metadata: prompt.metadata,
    }))

    return NextResponse.json({
      success: true,
      prompts,
    })
  } catch (error) {
    console.error("Prompts fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analysis prompts",
        prompts: [],
      },
      { status: 500 },
    )
  }
}
