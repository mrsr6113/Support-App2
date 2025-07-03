import { NextResponse } from "next/server"

interface ErrorLog {
  id: string
  timestamp: string
  type: string
  message: string
  location: string
  metadata?: any
}

// In-memory error storage (in production, use a database)
let errorLogs: ErrorLog[] = []

export async function GET() {
  try {
    const stats = {
      totalErrors: errorLogs.length,
      errorsByType: errorLogs.reduce(
        (acc, error) => {
          acc[error.type] = (acc[error.type] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
      errorsByLocation: errorLogs.reduce(
        (acc, error) => {
          acc[error.location] = (acc[error.location] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
      recentErrors: errorLogs.slice(-10).reverse(),
      lastHourErrors: errorLogs.filter((error) => new Date(error.timestamp).getTime() > Date.now() - 60 * 60 * 1000)
        .length,
    }

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error report generation failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const errorData = await request.json()

    const errorLog: ErrorLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: errorData.type || "UNKNOWN",
      message: errorData.message || "No message provided",
      location: errorData.location || "Unknown location",
      metadata: errorData.metadata,
    }

    errorLogs.push(errorLog)

    // Keep only last 1000 errors to prevent memory issues
    if (errorLogs.length > 1000) {
      errorLogs = errorLogs.slice(-1000)
    }

    return NextResponse.json({
      success: true,
      message: "Error logged successfully",
      errorId: errorLog.id,
    })
  } catch (error) {
    console.error("Error logging failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    errorLogs = []
    return NextResponse.json({
      success: true,
      message: "Error logs cleared successfully",
    })
  } catch (error) {
    console.error("Error clearing logs:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
