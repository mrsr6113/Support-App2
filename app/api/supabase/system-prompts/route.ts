import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_prompts")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, prompts: data })
  } catch (error) {
    console.error("System prompts fetch error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch system prompts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, prompt, description, isDefault } = await request.json()

    if (!name || !prompt) {
      return NextResponse.json({ success: false, error: "Name and prompt are required" }, { status: 400 })
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
