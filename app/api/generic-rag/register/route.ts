import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface TroubleshootingEntry {
  image: string // base64
  mimeType: string
  iconName: string
  iconDescription: string
  content: string
  category?: string
  subcategory?: string
  issueType?: string
  severityLevel?: string
  urgencyLevel?: string
  difficultyLevel?: string
  estimatedTimeMinutes?: number
  toolsRequired?: string[]
  safetyWarnings?: string[]
  tags?: string[]
  visualIndicators?: string[]
  indicatorStates?: string[]
}

interface BatchRegistrationRequest {
  entries: TroubleshootingEntry[]
  sessionId?: string
  userAgent?: string
  ipAddress?: string
}

// Generate image embeddings using Google's multimodal embedding
async function generateImageEmbedding(imageBase64: string, mimeType: string): Promise<number[] | null> {
  try {
    // Note: This is a conceptual implementation
    // In production, you would use Google Cloud Vertex AI multimodal embedding endpoint
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const result = await model.embedContent({
      content: {
        parts: [{ inlineData: { data: imageBase64, mimeType } }],
        role: "user",
      },
    })

    let embedding = result.embedding.values

    // Ensure exactly 1408 dimensions
    if (embedding.length !== 1408) {
      console.warn(`Embedding dimension mismatch: got ${embedding.length}, expected 1408`)

      if (embedding.length < 1408) {
        embedding = [...embedding, ...Array(1408 - embedding.length).fill(0)]
      } else {
        embedding = embedding.slice(0, 1408)
      }
    }

    return embedding
  } catch (error) {
    console.error("Error generating image embedding:", error)
    return null
  }
}

// Validate troubleshooting entry
function validateEntry(entry: TroubleshootingEntry): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields
  if (!entry.image || entry.image.trim() === "") {
    errors.push("Image is required")
  }

  if (!entry.mimeType || !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(entry.mimeType)) {
    errors.push("Invalid image format. Supported formats: JPG, PNG, WebP")
  }

  if (!entry.iconName || entry.iconName.trim() === "") {
    errors.push("Icon name is required")
  }

  if (!entry.iconDescription || entry.iconDescription.trim() === "") {
    errors.push("Icon description is required")
  }

  if (!entry.content || entry.content.trim() === "") {
    errors.push("Troubleshooting content is required")
  }

  // Length validations
  if (entry.iconName && entry.iconName.length > 200) {
    errors.push("Icon name must be less than 200 characters")
  }

  if (entry.iconDescription && entry.iconDescription.length > 1000) {
    errors.push("Icon description must be less than 1000 characters")
  }

  if (entry.content && entry.content.length > 10000) {
    errors.push("Troubleshooting content must be less than 10,000 characters")
  }

  // Image size validation (base64 length approximation)
  if (entry.image && entry.image.length > 13000000) {
    // ~10MB in base64
    errors.push("Image file size must be less than 10MB")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Extract visual indicators from content using AI
async function extractVisualIndicators(
  iconName: string,
  iconDescription: string,
  content: string,
): Promise<{
  visualIndicators: string[]
  indicatorStates: string[]
  tags: string[]
}> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const prompt = `Analyze this troubleshooting information and extract structured data:

Icon Name: ${iconName}
Icon Description: ${iconDescription}
Troubleshooting Content: ${content}

Extract and return ONLY a JSON object with these fields:
{
  "visualIndicators": ["array of visual indicator types like 'led_light', 'display_message', 'warning_symbol', etc."],
  "indicatorStates": ["array of states like 'blinking', 'solid', 'off', 'red', 'green', etc."],
  "tags": ["array of relevant tags for categorization and search"]
}

Focus on identifying:
- Types of visual indicators (lights, displays, symbols, gauges)
- States or conditions of these indicators
- Relevant keywords for categorization

Return only valid JSON, no additional text.`

    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 500,
      },
    })

    const response = result.response.text().trim()

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(response)
      return {
        visualIndicators: Array.isArray(parsed.visualIndicators) ? parsed.visualIndicators : [],
        indicatorStates: Array.isArray(parsed.indicatorStates) ? parsed.indicatorStates : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      }
    } catch (parseError) {
      console.warn("Failed to parse AI response as JSON:", response)
      return {
        visualIndicators: [],
        indicatorStates: [],
        tags: [],
      }
    }
  } catch (error) {
    console.error("Error extracting visual indicators:", error)
    return {
      visualIndicators: [],
      indicatorStates: [],
      tags: [],
    }
  }
}

// Log registration activity
async function logRegistration(
  sessionId: string,
  entriesCount: number,
  successCount: number,
  failureCount: number,
  processingTimeMs: number,
  errors?: string[],
  userAgent?: string,
  ipAddress?: string,
) {
  try {
    await supabaseAdmin.rpc("log_interaction", {
      p_session_id: sessionId,
      p_interaction_type: "entry_registration",
      p_category: "system_management",
      p_analysis_parameters: JSON.stringify({
        entriesCount,
        successCount,
        failureCount,
        processingTimeMs,
      }),
      p_similar_issues_found: successCount,
      p_response_generated: successCount > 0,
      p_processing_time_ms: processingTimeMs,
      p_error_type: failureCount > 0 ? "registration_error" : null,
      p_error_message: errors?.join("; ") || null,
      p_user_agent: userAgent,
      p_ip_address: ipAddress,
    })
  } catch (error) {
    console.error("Failed to log registration:", error)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let sessionId = ""

  try {
    const {
      entries,
      sessionId: requestSessionId,
      userAgent,
      ipAddress,
    }: BatchRegistrationRequest = await request.json()

    sessionId = requestSessionId || `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Validate request
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one troubleshooting entry is required.",
          results: [],
        },
        { status: 400 },
      )
    }

    if (entries.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum 50 entries allowed per batch.",
          results: [],
        },
        { status: 400 },
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "AI service is not properly configured.",
          results: [],
        },
        { status: 500 },
      )
    }

    const results: Array<{
      index: number
      success: boolean
      id?: string
      error?: string
      iconName: string
    }> = []

    let successCount = 0
    let failureCount = 0

    // Process each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]

      try {
        // Validate entry
        const validation = validateEntry(entry)
        if (!validation.valid) {
          results.push({
            index: i,
            success: false,
            error: validation.errors.join("; "),
            iconName: entry.iconName || `Entry ${i + 1}`,
          })
          failureCount++
          continue
        }

        // Generate image embedding
        const imageEmbedding = await generateImageEmbedding(entry.image, entry.mimeType)
        if (!imageEmbedding) {
          results.push({
            index: i,
            success: false,
            error: "Failed to generate image embedding",
            iconName: entry.iconName,
          })
          failureCount++
          continue
        }

        // Extract visual indicators using AI
        const extractedData = await extractVisualIndicators(entry.iconName, entry.iconDescription, entry.content)

        // Prepare database record
        const dbRecord = {
          title: entry.iconName,
          content: entry.content,
          icon_name: entry.iconName,
          icon_description: entry.iconDescription,
          image_embedding: imageEmbedding,
          category: entry.category || "general",
          subcategory: entry.subcategory,
          issue_type: entry.issueType || "visual_indicator",
          severity_level: entry.severityLevel || "medium",
          urgency_level: entry.urgencyLevel || "normal",
          difficulty_level: entry.difficultyLevel || "intermediate",
          estimated_time_minutes: entry.estimatedTimeMinutes || 15,
          tools_required: entry.toolsRequired || [],
          safety_warnings: entry.safetyWarnings || [],
          visual_indicators: [...(entry.visualIndicators || []), ...extractedData.visualIndicators],
          indicator_states: [...(entry.indicatorStates || []), ...extractedData.indicatorStates],
          tags: [...(entry.tags || []), ...extractedData.tags],
          source: "user_registration",
          is_active: true,
          metadata: {
            registrationSession: sessionId,
            registrationTimestamp: new Date().toISOString(),
            extractedByAI: {
              visualIndicators: extractedData.visualIndicators,
              indicatorStates: extractedData.indicatorStates,
              tags: extractedData.tags,
            },
          },
        }

        // Insert into database
        const { data, error } = await supabaseAdmin.from("rag_documents").insert(dbRecord).select("id").single()

        if (error) {
          console.error("Database insertion error:", error)
          results.push({
            index: i,
            success: false,
            error: `Database error: ${error.message}`,
            iconName: entry.iconName,
          })
          failureCount++
          continue
        }

        results.push({
          index: i,
          success: true,
          id: data.id,
          iconName: entry.iconName,
        })
        successCount++
      } catch (entryError) {
        console.error(`Error processing entry ${i}:`, entryError)
        results.push({
          index: i,
          success: false,
          error: entryError instanceof Error ? entryError.message : "Unknown error",
          iconName: entry.iconName || `Entry ${i + 1}`,
        })
        failureCount++
      }
    }

    const processingTime = Date.now() - startTime

    // Log the registration activity
    const errors = results.filter((r) => !r.success).map((r) => r.error || "Unknown error")
    await logRegistration(
      sessionId,
      entries.length,
      successCount,
      failureCount,
      processingTime,
      errors.length > 0 ? errors : undefined,
      userAgent,
      ipAddress,
    )

    return NextResponse.json({
      success: successCount > 0,
      message: `Registration completed: ${successCount} successful, ${failureCount} failed`,
      results,
      summary: {
        totalEntries: entries.length,
        successCount,
        failureCount,
        processingTimeMs: processingTime,
        sessionId,
      },
    })
  } catch (error) {
    const processingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    console.error("Error in registration endpoint:", error)

    await logRegistration(sessionId, 0, 0, 1, processingTime, [errorMessage])

    return NextResponse.json(
      {
        success: false,
        error: `Registration failed: ${errorMessage}`,
        results: [],
        summary: {
          totalEntries: 0,
          successCount: 0,
          failureCount: 1,
          processingTimeMs: processingTime,
          sessionId,
        },
      },
      { status: 500 },
    )
  }
}
