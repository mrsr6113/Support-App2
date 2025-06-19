import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("multimodal_analysis_prompts")
      .select("*")
      .eq("is_active", true)
      .order("analysis_type", { ascending: true })

    if (error) {
      console.error("Error fetching multimodal prompts:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          prompts: [],
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      prompts: data || [],
    })
  } catch (error) {
    console.error("Multimodal prompts fetch error:", error)
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
