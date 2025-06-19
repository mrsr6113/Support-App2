// Utility functions for multimodal RAG system

export interface RAGDocument {
  id: string
  title: string
  content: string
  icon_name?: string
  icon_description?: string
  product_type: string
  severity_level: string
  visual_indicators: string[]
  tags: string[]
  similarity?: number
}

export interface AnalysisResult {
  imageAnalysis: string
  similarIssues: RAGDocument[]
  productType: string
  analysisType: string
  matchCount: number
}

export const SEVERITY_LEVELS = {
  critical: { color: "red", label: "Critical", priority: 4, icon: "🚨" },
  high: { color: "orange", label: "High", priority: 3, icon: "⚠️" },
  medium: { color: "yellow", label: "Medium", priority: 2, icon: "⚡" },
  low: { color: "green", label: "Low", priority: 1, icon: "ℹ️" },
} as const

export const ANALYSIS_TYPES = {
  general: {
    name: "General Analysis",
    description: "Overall visual assessment and condition evaluation",
    icon: "👁️",
  },
  indicator: {
    name: "Indicator Analysis",
    description: "Focused analysis of lights, displays, and status indicators",
    icon: "💡",
  },
  damage: {
    name: "Damage Assessment",
    description: "Physical damage evaluation and safety assessment",
    icon: "🛡️",
  },
  diagnostic: {
    name: "Diagnostic Analysis",
    description: "Comprehensive troubleshooting and root cause analysis",
    icon: "🔍",
  },
} as const

export function formatSeverity(severity: string): string {
  return SEVERITY_LEVELS[severity as keyof typeof SEVERITY_LEVELS]?.label || severity
}

export function getSeverityIcon(severity: string): string {
  return SEVERITY_LEVELS[severity as keyof typeof SEVERITY_LEVELS]?.icon || "❓"
}

export function getSeverityPriority(severity: string): number {
  return SEVERITY_LEVELS[severity as keyof typeof SEVERITY_LEVELS]?.priority || 0
}

export function sortIssuesBySeverity(issues: RAGDocument[]): RAGDocument[] {
  return issues.sort((a, b) => getSeverityPriority(b.severity_level) - getSeverityPriority(a.severity_level))
}

export function filterIssuesByProductType(issues: RAGDocument[], productType: string): RAGDocument[] {
  if (!productType || productType === "general") return issues
  return issues.filter((issue) => issue.product_type === productType)
}

export function generateAnalysisSummary(result: AnalysisResult): string {
  const { similarIssues, matchCount, productType, analysisType } = result

  let summary = `Analysis completed for ${productType} using ${analysisType} method. `

  if (matchCount > 0) {
    const criticalIssues = similarIssues.filter((issue) => issue.severity_level === "critical")
    const highIssues = similarIssues.filter((issue) => issue.severity_level === "high")

    summary += `Found ${matchCount} similar issue(s) in knowledge base. `

    if (criticalIssues.length > 0) {
      summary += `🚨 ${criticalIssues.length} critical issue(s) require immediate attention. `
    }

    if (highIssues.length > 0) {
      summary += `⚠️ ${highIssues.length} high-priority issue(s) detected. `
    }
  } else {
    summary += "No similar issues found in knowledge base - analysis based on visual inspection only."
  }

  return summary
}

export function extractVisualIndicators(imageAnalysis: string): string[] {
  const indicators: string[] = []
  const text = imageAnalysis.toLowerCase()

  // Common visual indicators to look for
  const indicatorPatterns = [
    /red.*light/g,
    /green.*light/g,
    /blue.*light/g,
    /yellow.*light/g,
    /orange.*light/g,
    /blinking.*light/g,
    /flashing.*light/g,
    /error.*message/g,
    /warning.*symbol/g,
    /display.*shows/g,
    /screen.*displays/g,
    /gauge.*reading/g,
    /meter.*shows/g,
  ]

  indicatorPatterns.forEach((pattern) => {
    const matches = text.match(pattern)
    if (matches) {
      indicators.push(...matches)
    }
  })

  return [...new Set(indicators)] // Remove duplicates
}

export function calculateConfidenceScore(similarIssues: RAGDocument[]): number {
  if (similarIssues.length === 0) return 0

  const avgSimilarity = similarIssues.reduce((sum, issue) => sum + (issue.similarity || 0), 0) / similarIssues.length
  const topSimilarity = Math.max(...similarIssues.map((issue) => issue.similarity || 0))

  // Confidence based on both average similarity and top match
  return Math.round((avgSimilarity * 0.4 + topSimilarity * 0.6) * 100)
}

export function formatProductType(productType: string): string {
  return productType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: "Please upload a valid image file (JPG, PNG, or WebP)" }
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: "Image file size must be less than 10MB" }
  }

  return { valid: true }
}

export const DEFAULT_PROMPTS = {
  general: `Analyze this image of a product or device. Focus on identifying:
1. Visual indicators (LED lights, displays, screens, gauges, warning symbols)
2. Physical condition (damage, wear, misalignment, corrosion)
3. Error messages, status displays, or diagnostic information
4. Component positioning and connections
5. Any abnormal visual signs or conditions

Describe what you observe in detail, noting colors, patterns, text, and any indicators of malfunction.`,

  indicator: `Examine this image specifically for visual indicators such as:
- LED lights (note exact colors, blinking patterns, solid/off states)
- LCD/LED displays (error codes, messages, symbols, numbers)
- Warning lights or status indicators
- Gauge readings or meter positions
- Icon displays or symbol indicators

For each indicator found, describe the exact location, current state, and what it typically indicates.`,

  damage: `Assess this image for physical damage, wear, or safety concerns:
- Cracks, breaks, deformation, or structural damage
- Discoloration, burn marks, or heat damage
- Loose, missing, or misaligned components
- Corrosion, rust, or chemical damage
- Fluid leaks, stains, or contamination
- Wear patterns or deterioration
- Electrical damage or exposed wiring

Rate the severity and describe potential safety implications.`,

  diagnostic: `Analyze this image to provide diagnostic troubleshooting insights:
1. Identify the specific problem or malfunction shown
2. Determine the likely cause based on visual evidence
3. Assess the urgency and severity of the issue
4. Consider safety implications
5. Suggest immediate actions if safety is a concern

Structure your analysis with problem identification, severity assessment, likely cause, and recommended next steps.`,
}
