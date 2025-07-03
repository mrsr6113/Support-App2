export enum ErrorTypes {
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  PERMISSION_ERROR = "PERMISSION_ERROR",
  CAMERA_ACCESS_ERROR = "CAMERA_ACCESS_ERROR",
  SPEECH_RECOGNITION_ERROR = "SPEECH_RECOGNITION_ERROR",
  TTS_ERROR = "TTS_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface ErrorLogEntry {
  timestamp: Date
  type: ErrorTypes
  message: string
  location: string
  metadata?: any
}

class ErrorHandler {
  private errors: ErrorLogEntry[] = []
  private maxErrors = 100

  logError(error: Error, location: string, metadata?: any) {
    const errorEntry: ErrorLogEntry = {
      timestamp: new Date(),
      type: this.categorizeError(error),
      message: error.message,
      location,
      metadata,
    }

    this.errors.push(errorEntry)

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error(`[${errorEntry.type}] ${location}:`, error.message, metadata)
    }

    // Send to error reporting service in production
    if (typeof window !== "undefined") {
      this.reportError(errorEntry)
    }
  }

  private categorizeError(error: Error): ErrorTypes {
    const message = error.message.toLowerCase()

    if (message.includes("network") || message.includes("fetch")) {
      return ErrorTypes.NETWORK_ERROR
    }
    if (message.includes("api") || message.includes("http")) {
      return ErrorTypes.API_ERROR
    }
    if (message.includes("permission") || message.includes("denied")) {
      return ErrorTypes.PERMISSION_ERROR
    }
    if (message.includes("camera") || message.includes("media")) {
      return ErrorTypes.CAMERA_ACCESS_ERROR
    }
    if (message.includes("speech") || message.includes("recognition")) {
      return ErrorTypes.SPEECH_RECOGNITION_ERROR
    }
    if (message.includes("tts") || message.includes("text-to-speech")) {
      return ErrorTypes.TTS_ERROR
    }
    if (message.includes("validation") || message.includes("invalid")) {
      return ErrorTypes.VALIDATION_ERROR
    }

    return ErrorTypes.UNKNOWN_ERROR
  }

  private async reportError(errorEntry: ErrorLogEntry) {
    try {
      await fetch("/api/debug/error-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: errorEntry.type,
          message: errorEntry.message,
          location: errorEntry.location,
          metadata: errorEntry.metadata,
        }),
      })
    } catch (reportingError) {
      console.error("Failed to report error:", reportingError)
    }
  }

  getErrorStats() {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    return {
      total: this.errors.length,
      lastHour: this.errors.filter((error) => error.timestamp.getTime() > oneHourAgo).length,
      byType: this.errors.reduce(
        (acc, error) => {
          acc[error.type] = (acc[error.type] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      ),
      recent: this.errors.slice(-5),
    }
  }

  clearErrors() {
    this.errors = []
  }
}

export const errorHandler = new ErrorHandler()
