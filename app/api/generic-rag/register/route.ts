import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { supabaseAdmin } from "@/lib/supabase"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface RegistrationEntry {
  image: string
  mimeType: string
  iconName: string
  iconDescription: string
  content: string
  category: string
  tags: string[]
}

interface RegistrationRequest {
  entries: RegistrationEntry[]
  sessionId?: string
  userAgent?: string
  ipAddress?: string
}

// Enhanced logging function
async function logRegistrationEvent(
  sessionId: string,
  eventType: string,
  entryData?: any,
  error?: string,
  processingTime?: number,
  embeddingDimensions?: number,
) {
  try {
    const logEntry = {
      session_id: sessionId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      entry_data: entryData ? JSON.stringify(entryData) : null,
      error_message: error,
      processing_time_ms: processingTime,
      embedding_dimensions: embeddingDimensions,
      api_version: "v1.0",
    }

    console.log(`[RAG Registration] ${eventType}:`, logEntry)

    // Store in database for analytics
    await supabaseAdmin.from("registration_logs").insert(logEntry).select().single()
  } catch (logError) {
    console.error("Failed to log registration event:", logError)
  }
}

// Enhanced image embedding generation with retry logic
async function generateImageEmbedding(imageBase64: string, mimeType: string, retries = 3): Promise<number[] | null> {
  const startTime = Date.now()

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Embedding Generation] Attempt ${attempt}/${retries}`)

      // Validate image data
      if (!imageBase64 || imageBase64.length === 0) {
        throw new Error("Empty image data provided")
      }

      if (!mimeType || !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimeType)) {
        throw new Error(`Unsupported MIME type: ${mimeType}`)
      }

      // Use Gemini's embedding model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

      const result = await model.embedContent({
        content: {
          parts: [{ inlineData: { data: imageBase64, mimeType } }],
          role: "user",
        },
      })

      let embedding = result.embedding.values

      if (!embedding || embedding.length === 0) {
        throw new Error("Empty embedding returned from API")
      }

      console.log(`[Embedding Generation] Original dimensions: ${embedding.length}`)

      // Ensure exactly 1408 dimensions for pgvector compatibility
      const targetDimensions = 1408
      if (embedding.length !== targetDimensions) {
        console.warn(`[Embedding Generation] Dimension mismatch: got ${embedding.length}, expected ${targetDimensions}`)

        if (embedding.length < targetDimensions) {
          // Pad with zeros
          embedding = [...embedding, ...Array(targetDimensions - embedding.length).fill(0)]
        } else {
          // Truncate
          embedding = embedding.slice(0, targetDimensions)
        }
      }

      // Validate embedding values
      const invalidValues = embedding.filter((val) => !Number.isFinite(val))
      if (invalidValues.length > 0) {
        throw new Error(`Invalid embedding values detected: ${invalidValues.length} non-finite values`)
      }

      const processingTime = Date.now() - startTime
      console.log(`[Embedding Generation] Success in ${processingTime}ms, dimensions: ${embedding.length}`)

      return embedding
    } catch (error) {
      const processingTime = Date.now() - startTime
      console.error(`[Embedding Generation] Attempt ${attempt} failed after ${processingTime}ms:`, error)

      if (attempt === retries) {
        console.error(`[Embedding Generation] All ${retries} attempts failed`)
        return null
      }

      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000
      console.log(`[Embedding Generation] Waiting ${waitTime}ms before retry...`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  return null
}

// Enhanced document registration with comprehensive validation
async function registerDocument(
  entry: RegistrationEntry,
  embedding: number[],
  sessionId: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Validate required fields
    if (!entry.iconName || entry.iconName.trim().length === 0) {
      throw new Error("Icon name is required")
    }

    if (!entry.content || entry.content.trim().length === 0) {
      throw new Error("Content is required")
    }

    if (!embedding || embedding.length === 0) {
      throw new Error("Valid embedding is required")
    }

    // Prepare document data
    const documentData = {
      title: entry.iconName.trim(),
      content: entry.content.trim(),
      icon_name: entry.iconName.trim(),
      icon_description: entry.iconDescription?.trim() || entry.content.trim(),
      category: entry.category || "general",
      tags: Array.isArray(entry.tags) ? entry.tags.filter((tag) => tag.trim().length > 0) : [],
      image_embedding: embedding,
      source: "manual_registration",
      is_active: true,
      metadata: {
        registration_session: sessionId,
        registration_timestamp: new Date().toISOString(),
        image_mime_type: entry.mimeType,
        embedding_dimensions: embedding.length,
        content_length: entry.content.length,
        tags_count: entry.tags?.length || 0,
      },
    }

    console.log(`[Document Registration] Inserting document:`, {
      title: documentData.title,
      category: documentData.category,
      embedding_dimensions: embedding.length,
      tags_count: documentData.tags.length,
    })

    // Insert into database
    const { data, error } = await supabaseAdmin.from("rag_documents").insert(documentData).select().single()

    if (error) {
      console.error(`[Document Registration] Database error:`, error)
      throw new Error(`Database insertion failed: ${error.message}`)
    }

    if (!data) {
      throw new Error("No data returned from database insertion")
    }

    console.log(`[Document Registration] Success: Document ${data.id} created`)

    return { success: true, id: data.id }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown registration error"
    console.error(`[Document Registration] Failed:`, errorMessage)
    return { success: false, error: errorMessage }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const sessionId = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[RAG Registration] Starting session ${sessionId}`)

  try {
    // Validate API configuration
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured")
    }

    // Parse request
    const { entries, userAgent, ipAddress }: RegistrationRequest = await request.json()

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      throw new Error("No entries provided for registration")
    }

    if (entries.length > 50) {
      throw new Error("Too many entries (maximum 50 allowed)")
    }

    await logRegistrationEvent(sessionId, "registration_started", {
      entry_count: entries.length,
      user_agent: userAgent,
      ip_address: ipAddress,
    })

    const results = []

    // Process each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const entryStartTime = Date.now()

      console.log(`[RAG Registration] Processing entry ${i + 1}/${entries.length}`)

      try {
        // Validate entry
        if (!entry.image || !entry.mimeType) {
          throw new Error("Image data and MIME type are required")
        }

        if (!entry.iconName || !entry.content) {
          throw new Error("Icon name and content are required")
        }

        // Generate embedding
        console.log(`[RAG Registration] Generating embedding for entry ${i + 1}`)
        const embedding = await generateImageEmbedding(entry.image, entry.mimeType)

        if (!embedding) {
          throw new Error("Failed to generate image embedding")
        }

        await logRegistrationEvent(sessionId, "embedding_generated", {
          entry_index: i,
          icon_name: entry.iconName,
          embedding_dimensions: embedding.length,
        })

        // Register document
        console.log(`[RAG Registration] Registering document for entry ${i + 1}`)
        const registrationResult = await registerDocument(entry, embedding, sessionId)

        if (!registrationResult.success) {
          throw new Error(registrationResult.error || "Document registration failed")
        }

        const entryProcessingTime = Date.now() - entryStartTime

        results.push({
          success: true,
          id: registrationResult.id,
          iconName: entry.iconName,
          processingTimeMs: entryProcessingTime,
          embeddingDimensions: embedding.length,
        })

        await logRegistrationEvent(
          sessionId,
          "entry_completed",
          {
            entry_index: i,
            document_id: registrationResult.id,
            icon_name: entry.iconName,
          },
          undefined,
          entryProcessingTime,
          embedding.length,
        )

        console.log(`[RAG Registration] Entry ${i + 1} completed successfully in ${entryProcessingTime}ms`)
      } catch (entryError) {
        const entryProcessingTime = Date.now() - entryStartTime
        const errorMessage = entryError instanceof Error ? entryError.message : "Unknown entry error"

        console.error(`[RAG Registration] Entry ${i + 1} failed:`, errorMessage)

        results.push({
          success: false,
          error: errorMessage,
          iconName: entry.iconName || `Entry ${i + 1}`,
          processingTimeMs: entryProcessingTime,
        })

        await logRegistrationEvent(
          sessionId,
          "entry_failed",
          {
            entry_index: i,
            icon_name: entry.iconName,
          },
          errorMessage,
          entryProcessingTime,
        )
      }
    }

    const totalProcessingTime = Date.now() - startTime
    const successCount = results.filter((r) => r.success).length
    const failureCount = results.length - successCount

    await logRegistrationEvent(
      sessionId,
      "registration_completed",
      {
        total_entries: entries.length,
        successful_entries: successCount,
        failed_entries: failureCount,
      },
      undefined,
      totalProcessingTime,
    )

    console.log(`[RAG Registration] Session ${sessionId} completed: ${successCount}/${entries.length} successful`)

    return NextResponse.json({
      success: successCount > 0,
      sessionId,
      results,
      summary: {
        total: entries.length,
        successful: successCount,
        failed: failureCount,
        processingTimeMs: totalProcessingTime,
      },
    })
  } catch (error) {
    const totalProcessingTime = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown registration error"

    console.error(`[RAG Registration] Session ${sessionId} failed:`, errorMessage)

    await logRegistrationEvent(sessionId, "registration_failed", undefined, errorMessage, totalProcessingTime)

    return NextResponse.json(
      {
        success: false,
        sessionId,
        error: errorMessage,
        processingTimeMs: totalProcessingTime,
      },
      { status: 500 },
    )
  }
}
