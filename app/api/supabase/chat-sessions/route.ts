import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Session ID is required" }, { status: 400 })
    }

    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin.from("chat_sessions").select("id").limit(1)

    if (tableError && tableError.code === "42P01") {
      console.warn("Chat sessions table does not exist. Please run the database setup script.")
      return NextResponse.json({
        success: true,
        session: null,
        message: "Database tables not initialized. Please run the setup script.",
      })
    }

    const { data, error } = await supabaseAdmin.from("chat_sessions").select("*").eq("session_id", sessionId).single()

    if (error && error.code !== "PGRST116") {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, session: data })
  } catch (error) {
    console.error("Chat session fetch error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch chat session" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, messages } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Session ID is required" }, { status: 400 })
    }

    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin.from("chat_sessions").select("id").limit(1)

    if (tableError && tableError.code === "42P01") {
      return NextResponse.json(
        {
          success: false,
          error: "Database tables not initialized. Please run the setup script first.",
        },
        { status: 500 },
      )
    }

    // Upsert the chat session
    const { data, error } = await supabaseAdmin
      .from("chat_sessions")
      .upsert(
        {
          session_id: sessionId,
          messages: messages || [],
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id",
        },
      )
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, session: data })
  } catch (error) {
    console.error("Chat session save error:", error)
    return NextResponse.json({ success: false, error: "Failed to save chat session" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Session ID is required" }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from("chat_sessions").delete().eq("session_id", sessionId)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Chat session deletion error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete chat session" }, { status: 500 })
  }
}
