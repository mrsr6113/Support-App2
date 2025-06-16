import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("visual_analysis_prompts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, prompts: data })
  } catch (error) {
    console.error("Visual prompts fetch error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch visual analysis prompts" }, { status: 500 })
  }
}
