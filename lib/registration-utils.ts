// Utility functions for troubleshooting entry registration

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ImageValidationResult {
  valid: boolean
  error?: string
  metadata?: {
    width: number
    height: number
    size: number
    format: string
  }
}

// Validate image file
export function validateImageFile(file: File): ImageValidationResult {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid image format. Supported formats: JPG, PNG, WebP",
    }
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      error: "Image file size must be less than 10MB",
    }
  }

  if (file.size < 1024) {
    return {
      valid: false,
      error: "Image file is too small (minimum 1KB)",
    }
  }

  return {
    valid: true,
    metadata: {
      width: 0, // Would need to load image to get actual dimensions
      height: 0,
      size: file.size,
      format: file.type,
    },
  }
}

// Validate troubleshooting entry content
export function validateEntryContent(entry: {
  iconName: string
  iconDescription: string
  content: string
  category?: string
  estimatedTimeMinutes?: number
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required field validation
  if (!entry.iconName?.trim()) {
    errors.push("Icon name is required")
  } else if (entry.iconName.length > 200) {
    errors.push("Icon name must be less than 200 characters")
  } else if (entry.iconName.length < 3) {
    warnings.push("Icon name is very short - consider being more descriptive")
  }

  if (!entry.iconDescription?.trim()) {
    errors.push("Icon description is required")
  } else if (entry.iconDescription.length > 1000) {
    errors.push("Icon description must be less than 1000 characters")
  } else if (entry.iconDescription.length < 10) {
    warnings.push("Icon description is very short - consider adding more detail")
  }

  if (!entry.content?.trim()) {
    errors.push("Troubleshooting content is required")
  } else if (entry.content.length > 10000) {
    errors.push("Troubleshooting content must be less than 10,000 characters")
  } else if (entry.content.length < 20) {
    warnings.push("Troubleshooting content is very short - consider adding more detailed steps")
  }

  // Content quality checks
  if (entry.content && !entry.content.toLowerCase().includes("step")) {
    warnings.push("Consider breaking down the solution into clear steps")
  }

  if (entry.estimatedTimeMinutes && (entry.estimatedTimeMinutes < 1 || entry.estimatedTimeMinutes > 480)) {
    errors.push("Estimated time must be between 1 and 480 minutes")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// Generate suggested tags from content
export function generateSuggestedTags(iconName: string, iconDescription: string, content: string): string[] {
  const text = `${iconName} ${iconDescription} ${content}`.toLowerCase()
  const suggestedTags: string[] = []

  // Common indicator types
  const indicatorPatterns = [
    { pattern: /led|light/g, tag: "led" },
    { pattern: /display|screen/g, tag: "display" },
    { pattern: /warning|alert/g, tag: "warning" },
    { pattern: /error|fault/g, tag: "error" },
    { pattern: /status|indicator/g, tag: "status" },
    { pattern: /maintenance|service/g, tag: "maintenance" },
    { pattern: /safety|danger/g, tag: "safety" },
    { pattern: /power|electrical/g, tag: "electrical" },
    { pattern: /mechanical|motor/g, tag: "mechanical" },
    { pattern: /sensor|detection/g, tag: "sensor" },
  ]

  // Color patterns
  const colorPatterns = [
    { pattern: /red/g, tag: "red" },
    { pattern: /green/g, tag: "green" },
    { pattern: /blue/g, tag: "blue" },
    { pattern: /yellow|amber/g, tag: "yellow" },
    { pattern: /orange/g, tag: "orange" },
  ]

  // State patterns
  const statePatterns = [
    { pattern: /blinking|flashing/g, tag: "blinking" },
    { pattern: /solid|steady/g, tag: "solid" },
    { pattern: /off|disabled/g, tag: "off" },
    { pattern: /on|enabled/g, tag: "on" },
  ]

  // Check all patterns
  const allPatterns = [...indicatorPatterns, ...colorPatterns, ...statePatterns]

  allPatterns.forEach(({ pattern, tag }) => {
    if (pattern.test(text) && !suggestedTags.includes(tag)) {
      suggestedTags.push(tag)
    }
  })

  return suggestedTags.slice(0, 10) // Limit to 10 suggestions
}

// Format entry for API submission
export function formatEntryForSubmission(entry: any): any {
  return {
    iconName: entry.iconName?.trim(),
    iconDescription: entry.iconDescription?.trim(),
    content: entry.content?.trim(),
    category: entry.category || "general",
    subcategory: entry.subcategory?.trim() || undefined,
    issueType: entry.issueType || "visual_indicator",
    severityLevel: entry.severityLevel || "medium",
    urgencyLevel: entry.urgencyLevel || "normal",
    difficultyLevel: entry.difficultyLevel || "intermediate",
    estimatedTimeMinutes: entry.estimatedTimeMinutes || 15,
    toolsRequired: Array.isArray(entry.toolsRequired) ? entry.toolsRequired.filter(Boolean) : [],
    safetyWarnings: Array.isArray(entry.safetyWarnings) ? entry.safetyWarnings.filter(Boolean) : [],
    tags: Array.isArray(entry.tags) ? entry.tags.filter(Boolean) : [],
    visualIndicators: Array.isArray(entry.visualIndicators) ? entry.visualIndicators.filter(Boolean) : [],
    indicatorStates: Array.isArray(entry.indicatorStates) ? entry.indicatorStates.filter(Boolean) : [],
  }
}

// Convert file to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(",")[1]) // Remove data:image/...;base64, prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Batch validation for multiple entries
export function validateEntryBatch(entries: any[]): {
  valid: boolean
  totalErrors: number
  totalWarnings: number
  validEntries: number
  results: Array<{
    index: number
    valid: boolean
    errors: string[]
    warnings: string[]
  }>
} {
  const results = entries.map((entry, index) => {
    const validation = validateEntryContent(entry)
    return {
      index,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    }
  })

  const validEntries = results.filter((r) => r.valid).length
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0)

  return {
    valid: validEntries > 0,
    totalErrors,
    totalWarnings,
    validEntries,
    results,
  }
}
