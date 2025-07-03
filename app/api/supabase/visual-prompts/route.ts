import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: prompts, error } = await supabase
      .from("visual_analysis_prompts")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "データベースエラーが発生しました",
          details: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      prompts: prompts || [],
    })
  } catch (error) {
    console.error("Visual prompts API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "ビジュアル分析プロンプトの取得に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name, prompt, priority, category } = await request.json()

    if (!name || !prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "名前とプロンプトは必須です",
        },
        { status: 400 },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
      .from("visual_analysis_prompts")
      .insert([
        {
          name,
          prompt,
          priority: priority || 1,
          category: category || "general",
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "プロンプトの保存に失敗しました",
          details: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      prompt: data[0],
    })
  } catch (error) {
    console.error("Visual prompts POST error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "プロンプトの作成に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, prompt, priority, category, is_active } = await request.json()

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "IDが必要です",
        },
        { status: 400 },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (prompt !== undefined) updateData.prompt = prompt
    if (priority !== undefined) updateData.priority = priority
    if (category !== undefined) updateData.category = category
    if (is_active !== undefined) updateData.is_active = is_active
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase.from("visual_analysis_prompts").update(updateData).eq("id", id).select()

    if (error) {
      console.error("Supabase update error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "プロンプトの更新に失敗しました",
          details: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      prompt: data[0],
    })
  } catch (error) {
    console.error("Visual prompts PUT error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "プロンプトの更新に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "IDが必要です",
        },
        { status: 400 },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase.from("visual_analysis_prompts").delete().eq("id", id)

    if (error) {
      console.error("Supabase delete error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "プロンプトの削除に失敗しました",
          details: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "プロンプトが削除されました",
    })
  } catch (error) {
    console.error("Visual prompts DELETE error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "プロンプトの削除に失敗しました",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
