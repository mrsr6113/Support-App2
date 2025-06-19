import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    // Get distinct product types from existing rag_documents
    const { data, error } = await supabaseAdmin
      .from("rag_documents")
      .select("product_type")
      .not("product_type", "is", null)
      .eq("is_active", true)

    if (error) {
      console.error("Error fetching product types:", error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          productTypes: [],
        },
        { status: 500 },
      )
    }

    // Get unique product types
    const uniqueTypes = [...new Set(data?.map((item) => item.product_type) || [])]

    // Create formatted product type objects
    const productTypes = uniqueTypes.map((type) => ({
      value: type,
      label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " "),
      count: data?.filter((item) => item.product_type === type).length || 0,
    }))

    return NextResponse.json({
      success: true,
      productTypes: productTypes.sort((a, b) => a.label.localeCompare(b.label)),
    })
  } catch (error) {
    console.error("Product types fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch product types",
        productTypes: [],
      },
      { status: 500 },
    )
  }
}
