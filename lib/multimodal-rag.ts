// Utility functions for multimodal RAG system

export interface ProductIssue {
  id: string
  product_category: string
  icon_name: string
  icon_description: string
  content: string
  tags: string[]
  severity_level: "low" | "medium" | "high" | "critical"
  similarity?: number
}

export interface AnalysisResult {
  imageAnalysis: string
  matchedIssues: ProductIssue[]
  confidence: number
  recommendations: string[]
}

export const SEVERITY_LEVELS = {
  low: { color: "green", label: "Low", priority: 1 },
  medium: { color: "yellow", label: "Medium", priority: 2 },
  high: { color: "orange", label: "High", priority: 3 },
  critical: { color: "red", label: "Critical", priority: 4 },
} as const

export const ANALYSIS_TYPES = {
  general: {
    name: "General Analysis",
    description: "Overall assessment of the product condition and visible indicators",
    icon: "eye",
  },
  detailed: {
    name: "Detailed Indicators",
    description: "Focused analysis of specific lights, displays, and status indicators",
    icon: "search",
  },
  damage: {
    name: "Damage Assessment",
    description: "Physical damage evaluation and safety assessment",
    icon: "alert-circle",
  },
} as const

export function formatSeverity(severity: string): string {
  return SEVERITY_LEVELS[severity as keyof typeof SEVERITY_LEVELS]?.label || severity
}

export function getSeverityPriority(severity: string): number {
  return SEVERITY_LEVELS[severity as keyof typeof SEVERITY_LEVELS]?.priority || 0
}

export function sortIssuesBySeverity(issues: ProductIssue[]): ProductIssue[] {
  return issues.sort((a, b) => getSeverityPriority(b.severity_level) - getSeverityPriority(a.severity_level))
}

export function filterIssuesByCategory(issues: ProductIssue[], category: string): ProductIssue[] {
  if (!category || category === "general") return issues
  return issues.filter((issue) => issue.product_category === category)
}

export function generateTroubleshootingSummary(issues: ProductIssue[]): string {
  if (issues.length === 0) return "No specific issues identified."

  const criticalIssues = issues.filter((issue) => issue.severity_level === "critical")
  const highIssues = issues.filter((issue) => issue.severity_level === "high")

  let summary = `Found ${issues.length} potential issue(s). `

  if (criticalIssues.length > 0) {
    summary += `⚠️ ${criticalIssues.length} critical issue(s) require immediate attention. `
  }

  if (highIssues.length > 0) {
    summary += `🔴 ${highIssues.length} high-priority issue(s) detected. `
  }

  return summary
}

export const DEFAULT_PRODUCT_CATEGORIES = [
  { name: "coffee_maker", label: "Coffee Makers", icon: "coffee" },
  { name: "printer", label: "Printers", icon: "printer" },
  { name: "router", label: "Network Equipment", icon: "wifi" },
  { name: "appliance", label: "Home Appliances", icon: "home" },
  { name: "electronics", label: "Consumer Electronics", icon: "monitor" },
  { name: "automotive", label: "Automotive", icon: "car" },
  { name: "hvac", label: "HVAC Systems", icon: "thermometer" },
  { name: "general", label: "General Products", icon: "package" },
]
