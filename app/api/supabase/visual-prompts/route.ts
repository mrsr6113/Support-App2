import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin
      .from("visual_analysis_prompts")
      .select("id")
      .limit(1)

    if (tableError && tableError.code === "42P01") {
      // Table doesn't exist
      console.warn("Visual analysis prompts table does not exist. Please run the database setup script.")
      return NextResponse.json({
        success: true,
        prompts: [],
        message: "Database tables not initialized. Please run the setup script.",
      })
    }

    const { data, error } = await supabaseAdmin
      .from("visual_analysis_prompts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          prompts: [],
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, prompts: data || [] })
  } catch (error) {
    console.error("Visual prompts fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch visual analysis prompts",
        prompts: [],
      },
      { status: 500 },
    )
  }
}
