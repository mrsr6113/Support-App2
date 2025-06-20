import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin.from("rag_documents").select("id").limit(1)

    if (tableError && tableError.code === "42P01") {
      // Table doesn't exist
      console.warn("RAG documents table does not exist. Please run the database setup script.")
      return NextResponse.json({
        success: true,
        documents: [],
        message: "Database tables not initialized. Please run the setup script.",
      })
    }

    const { data, error } = await supabaseAdmin
      .from("rag_documents")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          documents: [],
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, documents: data || [] })
  } catch (error) {
    console.error("RAG documents fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch RAG documents",
        documents: [],
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, category, tags, iconName, iconDescription, imageBase64, mimeType } = await request.json()

    if (!title || !content) {
      return NextResponse.json({ success: false, error: "Title and content are required" }, { status: 400 })
    }

    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin.from("rag_documents").select("id").limit(1)

    if (tableError && tableError.code === "42P01") {
      return NextResponse.json(
        {
          success: false,
          error: "Database tables not initialized. Please run the setup script first.",
        },
        { status: 500 },
      )
    }

    // Generate image embedding if image is provided
    const imageEmbedding = null
    if (imageBase64 && mimeType) {
      try {
        const embeddingResponse = await fetch("/api/generic-rag/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: [
              {
                image: imageBase64,
                mimeType,
                iconName: iconName || title,
                iconDescription: iconDescription || content,
                content,
                category: category || "general",
                tags: Array.isArray(tags) ? tags : [],
              },
            ],
          }),
        })

        const embeddingResult = await embeddingResponse.json()
        if (embeddingResult.success && embeddingResult.results?.[0]?.success) {
          return NextResponse.json({
            success: true,
            document: { id: embeddingResult.results[0].id },
            message: "Document registered successfully with image embedding",
          })
        }
      } catch (embeddingError) {
        console.error("Image embedding error:", embeddingError)
        // Continue with text-only registration
      }
    }

    // Fallback to text-only registration
    const { data, error } = await supabaseAdmin
      .from("rag_documents")
      .insert({
        title,
        content,
        category: category || "general",
        tags: Array.isArray(tags) ? tags : [],
        icon_name: iconName,
        icon_description: iconDescription,
        source: "manual_entry",
        is_active: true,
        metadata: {
          registrationTimestamp: new Date().toISOString(),
          hasImage: !!imageBase64,
        },
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

export async function PUT(request: NextRequest) {
  try {
    const { id, title, content, category, tags, iconName, iconDescription, imageBase64, mimeType } =
      await request.json()

    if (!id) {
      return NextResponse.json({ success: false, error: "Document ID is required" }, { status: 400 })
    }

    if (!title || !content) {
      return NextResponse.json({ success: false, error: "Title and content are required" }, { status: 400 })
    }

    // Check if the table exists first
    const { data: tableExists, error: tableError } = await supabaseAdmin.from("rag_documents").select("id").limit(1)

    if (tableError && tableError.code === "42P01") {
      return NextResponse.json(
        {
          success: false,
          error: "Database tables not initialized. Please run the setup script first.",
        },
        { status: 500 },
      )
    }

    // If new image is provided, we need to update the embedding
    if (imageBase64 && mimeType) {
      try {
        // First, delete the old document
        await supabaseAdmin.from("rag_documents").delete().eq("id", id)

        // Then create a new one with updated embedding
        const embeddingResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/generic-rag/register`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entries: [
                {
                  image: imageBase64,
                  mimeType,
                  iconName: iconName || title,
                  iconDescription: iconDescription || content,
                  content,
                  category: category || "general",
                  tags: Array.isArray(tags) ? tags : [],
                },
              ],
            }),
          },
        )

        const embeddingResult = await embeddingResponse.json()
        if (embeddingResult.success && embeddingResult.results?.[0]?.success) {
          return NextResponse.json({
            success: true,
            document: { id: embeddingResult.results[0].id },
            message: "Document updated successfully with new image embedding",
          })
        }
      } catch (embeddingError) {
        console.error("Image embedding error:", embeddingError)
        // Continue with text-only update if embedding fails
      }
    }

    // Standard update without new image
    const updateData: any = {
      title,
      content,
      category: category || "general",
      tags: Array.isArray(tags) ? tags : [],
      icon_name: iconName,
      icon_description: iconDescription,
      updated_at: new Date().toISOString(),
      metadata: {
        lastModified: new Date().toISOString(),
        hasImage: !!imageBase64,
      },
    }

    const { data, error } = await supabaseAdmin.from("rag_documents").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Supabase update error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: false, error: "Document not found or update failed" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      document: data,
      message: "Document updated successfully",
    })
  } catch (error) {
    console.error("RAG document update error:", error)
    return NextResponse.json({ success: false, error: "Failed to update RAG document" }, { status: 500 })
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
