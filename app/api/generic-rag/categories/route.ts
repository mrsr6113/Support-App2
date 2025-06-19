import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    // Get categories from the issue_categories table
    const { data: categoriesData, error: categoriesError } = await supabaseAdmin
      .from("issue_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError)
    }

    // Get category usage statistics from rag_documents
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from("rag_documents")
      .select("category")
      .eq("is_active", true)

    if (usageError) {
      console.error("Error fetching category usage:", usageError)
    }

    // Count usage for each category
    const usageCount: Record<string, number> = {}
    if (usageData) {
      usageData.forEach((item) => {
        const category = item.category || "general"
        usageCount[category] = (usageCount[category] || 0) + 1
      })
    }

    // Combine category definitions with usage statistics
    const categories = (categoriesData || []).map((category) => ({
      value: category.name,
      label: category.display_name,
      description: category.description,
      icon: category.icon_name,
      color: category.color_code,
      count: usageCount[category.name] || 0,
      parentCategory: category.parent_category,
      metadata: category.metadata,
    }))

    // Add any categories from rag_documents that aren't in issue_categories
    const definedCategories = new Set(categories.map((c) => c.value))
    Object.keys(usageCount).forEach((categoryName) => {
      if (!definedCategories.has(categoryName)) {
        categories.push({
          value: categoryName,
          label: categoryName.charAt(0).toUpperCase() + categoryName.slice(1).replace(/_/g, " "),
          description: `Auto-detected category: ${categoryName}`,
          icon: "folder",
          color: "#6B7280",
          count: usageCount[categoryName],
          parentCategory: null,
          metadata: {},
        })
      }
    })

    return NextResponse.json({
      success: true,
      categories: categories.sort((a, b) => b.count - a.count), // Sort by usage
    })
  } catch (error) {
    console.error("Categories fetch error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch categories",
        categories: [],
      },
      { status: 500 },
    )
  }
}
