import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin.from("system_prompts").select("id").limit(1)

    if (tableError && tableError.code === "42P01") {
      // Table doesn't exist
      console.warn("System prompts table does not exist. Please run the database setup script.")
      return NextResponse.json({
        success: true,
        prompts: [],
        message: "Database tables not initialized. Please run the setup script.",
      })
    }

    const { data, error } = await supabaseAdmin
      .from("system_prompts")
      .select("*")
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
    console.error("System prompts fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch system prompts",
        prompts: [],
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, prompt, description, isDefault } = await request.json()

    if (!name || !prompt) {
      return NextResponse.json({ success: false, error: "Name and prompt are required" }, { status: 400 })
    }

    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin.from("system_prompts").select("id").limit(1)

    if (tableError && tableError.code === "42P01") {
      return NextResponse.json(
        {
          success: false,
          error: "Database tables not initialized. Please run the setup script first.",
        },
        { status: 500 },
      )
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await supabaseAdmin.from("system_prompts").update({ is_default: false }).eq("is_default", true)
    }

    const { data, error } = await supabaseAdmin
      .from("system_prompts")
      .insert({
        name,
        prompt,
        description,
        is_default: isDefault || false,
      })
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, prompt: data })
  } catch (error) {
    console.error("System prompt creation error:", error)
    return NextResponse.json({ success: false, error: "Failed to create system prompt" }, { status: 500 })
  }
}
