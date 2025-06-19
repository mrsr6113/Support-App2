import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_name")

    if (error) {
      console.error("Error fetching product categories:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          categories: [],
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      categories: data || [],
    })
  } catch (error) {
    console.error("Product categories fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch product categories",
        categories: [],
      },
      { status: 500 },
    )
  }
}
