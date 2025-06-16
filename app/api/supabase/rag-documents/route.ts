import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("rag_documents")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, documents: data })
  } catch (error) {
    console.error("RAG documents fetch error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch RAG documents" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, category, tags } = await request.json()

    if (!title || !content) {
      return NextResponse.json({ success: false, error: "Title and content are required" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("rag_documents")
      .insert({
        title,
        content,
        category: category || "general",
        tags: tags || [],
      })
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, document: data })
  } catch (error) {
    console.error("RAG document creation error:", error)
    return NextResponse.json({ success: false, error: "Failed to create RAG document" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ success: false, error: "Document ID is required" }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from("rag_documents").delete().eq("id", id)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("RAG document deletion error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete RAG document" }, { status: 500 })
  }
}
