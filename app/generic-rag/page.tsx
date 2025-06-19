"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  User,
  Bot,
  Loader2,
  Upload,
  Search,
  Wrench,
  Eye,
  Play,
  Square,
  Zap,
  Shield,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
} from "lucide-react"

interface ChatMessage {
  id: string
  type: "user" | "ai" | "system"
  content: string
  imagePreview?: string
  metadata?: {
    category?: string
    analysisType?: string
    similarIssues?: SimilarIssue[]
    matchCount?: number
    processingTimeMs?: number
    sessionId?: string
  }
}

interface SimilarIssue {
  id: string
  title: string
  content: string
  icon_name?: string
  icon_description?: string
  category: string
  subcategory?: string
  issue_type: string
  severity_level: string
  urgency_level: string
  visual_indicators: string[]
  indicator_states: string[]
  difficulty_level: string
  estimated_time_minutes: number
  tools_required: string[]
  safety_warnings: string[]
  tags: string[]
  metadata: any
  similarity: number
}

interface Category {
  value: string
  label: string
  description: string
  icon: string
  color: string
  count: number
  parentCategory?: string
  metadata: any
}

interface AnalysisPrompt {
  id: string
  name: string
  description: string
  analysisType: string
  promptType: string
  category?: string
  priority: number
  metadata: any
}

interface SystemStats {
  totalDocuments: number
  categoryCounts: Record<string, number>
  issueTypeCounts: Record<string, number>
  severityCounts: Record<string, number>
  difficultyCounts: Record<string, number>
  recentInteractions: number
  interactionTypes: Record<string, number>
}

export default function GenericRAGPage() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState("")
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("general")
  const [analysisType, setAnalysisType] = useState<string>("general")
  const [categories, setCategories] = useState<Category[]>([])
  const [analysisPrompts, setAnalysisPrompts] = useState<AnalysisPrompt[]>([])
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [isStarted, setIsStarted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [sessionId, setSessionId] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generate session ID
  useEffect(() => {
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  }, [])

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase(),
      )
      setIsMobile(isMobileDevice)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Fetch configuration data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const categoriesResponse = await fetch("/api/generic-rag/categories")
        const categoriesResult = await categoriesResponse.json()
        if (categoriesResult.success) {
          setCategories(categoriesResult.categories)
        }

        // Fetch analysis prompts
        const promptsResponse = await fetch("/api/generic-rag/prompts")
        const promptsResult = await promptsResponse.json()
        if (promptsResult.success) {
          setAnalysisPrompts(promptsResult.prompts)
        }

        // Fetch system statistics
        const statsResponse = await fetch("/api/generic-rag/stats")
        const statsResult = await statsResponse.json()
        if (statsResult.success) {
          setSystemStats(statsResult.stats)
        }
      } catch (error) {
        console.error("Failed to fetch configuration data:", error)
      }
    }

    fetchData()
  }, [])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      if (!validTypes.includes(file.type)) {
        setError("Please upload a valid image file (JPG, PNG, or WebP)")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Image file size must be less than 10MB")
        return
      }

      setUploadedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const addMessage = (type: "user" | "ai" | "system", content: string, imgPreview?: string, metadata?: any) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type,
        content,
        imagePreview: imgPreview,
        metadata,
      },
    ])
  }

  const handleStart = () => {
    setIsStarted(true)
    addMessage(
      "system",
      `🔧 **Generic Multimodal RAG System Activated**

This system can analyze images of any product or device to identify issues and provide troubleshooting solutions. The system works with:

📊 **Knowledge Base**: ${systemStats?.totalDocuments || "Loading..."} troubleshooting documents
🏷️ **Categories**: ${Object.keys(systemStats?.categoryCounts || {}).length || "Loading..."} product categories
🔍 **Analysis Types**: ${analysisPrompts.length || "Loading..."} specialized analysis modes

Upload an image of your product issue to get started!`,
    )
  }

  const handleStop = () => {
    setIsStarted(false)
    setChatMessages([])
    setUploadedImage(null)
    setImagePreview(null)
    setUserInput("")
    setError(null)
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  }

  const handleSubmit = async () => {
    if (!uploadedImage) {
      setError("Please upload an image of the product issue for analysis.")
      return
    }

    setIsLoading(true)
    setError(null)

    const userMessageContent = userInput.trim() || "Please analyze this image for troubleshooting."
    const categoryLabel = categories.find((cat) => cat.value === selectedCategory)?.label || "General"
    const analysisTypeLabel =
      analysisPrompts.find((prompt) => prompt.analysisType === analysisType)?.description || analysisType

    addMessage(
      "user",
      `${userMessageContent}\n\n📂 **Category**: ${categoryLabel}\n🔍 **Analysis**: ${analysisTypeLabel}`,
      imagePreview || undefined,
    )
    setUserInput("")

    try {
      const reader = new FileReader()
      reader.readAsDataURL(uploadedImage)
      reader.onloadend = async () => {
        const base64Image = (reader.result as string).split(",")[1]
        const mimeType = uploadedImage.type

        const historyForApi = chatMessages
          .filter((msg) => msg.type === "user" || msg.type === "ai")
          .map((msg) => ({
            role: msg.type === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          }))

        const response = await fetch("/api/generic-rag/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Image,
            mimeType,
            category: selectedCategory,
            analysisType,
            chatHistory: historyForApi,
            sessionId,
            userAgent: navigator.userAgent,
            ipAddress: null, // Will be determined server-side
          }),
        })

        const result = await response.json()

        if (result.success) {
          addMessage("ai", result.response, undefined, {
            category: result.category,
            analysisType: result.analysisType,
            similarIssues: result.similarIssues,
            matchCount: result.matchCount,
            processingTimeMs: result.processingTimeMs,
            sessionId: result.sessionId,
          })

          // Show knowledge base match information
          if (result.matchCount > 0) {
            const criticalIssues = result.similarIssues.filter(
              (issue: SimilarIssue) => issue.severity_level === "critical",
            )
            const highIssues = result.similarIssues.filter((issue: SimilarIssue) => issue.severity_level === "high")

            let matchSummary = `🎯 **Knowledge Base Matches**: Found ${result.matchCount} similar issue(s)\n\n`

            if (criticalIssues.length > 0) {
              matchSummary += `🚨 **Critical Issues**: ${criticalIssues.length} require immediate attention\n`
            }

            if (highIssues.length > 0) {
              matchSummary += `⚠️ **High Priority**: ${highIssues.length} high-priority issues detected\n`
            }

            matchSummary += `\n**Top Matches**:\n${result.similarIssues
              .slice(0, 3)
              .map(
                (issue: SimilarIssue, index: number) =>
                  `${index + 1}. ${issue.title} (${(issue.similarity * 100).toFixed(1)}% match)\n   Category: ${issue.category} | Severity: ${issue.severity_level}`,
              )
              .join("\n")}`

            matchSummary += `\n\n⏱️ **Processing Time**: ${result.processingTimeMs}ms`

            addMessage("system", matchSummary)
          } else {
            addMessage(
              "system",
              `ℹ️ **No Similar Issues Found**\n\nNo matching issues found in the knowledge base for this specific problem. The analysis is based on visual inspection and general troubleshooting principles.\n\n⏱️ **Processing Time**: ${result.processingTimeMs}ms`,
            )
          }
        } else {
          setError(result.error || "Analysis failed")
          addMessage("ai", `❌ **Analysis Failed**: ${result.error || "Unknown error"}`)
        }

        // Reset image after processing
        setUploadedImage(null)
        setImagePreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
      reader.onerror = () => {
        throw new Error("Failed to read image file.")
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred."
      setError(errorMessage)
      addMessage("ai", `❌ **Error**: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getAnalysisIcon = (type: string) => {
    switch (type) {
      case "visual_indicators":
        return <Zap className="w-4 h-4" />
      case "physical_damage":
        return <Shield className="w-4 h-4" />
      case "diagnostic":
        return <Search className="w-4 h-4" />
      default:
        return <Eye className="w-4 h-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "destructive"
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return <AlertTriangle className="w-4 h-4" />
      case "high":
        return <AlertCircle className="w-4 h-4" />
      case "medium":
        return <Info className="w-4 h-4" />
      case "low":
        return <CheckCircle className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "zap":
        return <Zap className="w-4 h-4" />
      case "shield":
        return <Shield className="w-4 h-4" />
      case "settings":
        return <Settings className="w-4 h-4" />
      case "wrench":
        return <Wrench className="w-4 h-4" />
      default:
        return <Settings className="w-4 h-4" />
    }
  }

  // Calculate upload area size - 3x larger on mobile when started
  const getUploadAreaClasses = () => {
    const baseClasses =
      "border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-all duration-300"

    if (isMobile && isStarted) {
      return `${baseClasses} min-h-[300px] transform scale-150 origin-top mb-8` // 3x larger on mobile when started
    } else if (isMobile) {
      return `${baseClasses} min-h-[120px]`
    } else {
      return `${baseClasses} min-h-[180px]`
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-6 h-6" />
            Generic Multimodal RAG System
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={analysisType} onValueChange={setAnalysisType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent>
                  {analysisPrompts.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.analysisType}>
                      {prompt.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Button onClick={handleStart} disabled={isStarted}>
                Start Analysis
              </Button>
              <Button onClick={handleStop} disabled={!isStarted}>
                Stop Analysis
              </Button>
            </div>
            <div className={getUploadAreaClasses()} onClick={() => fileInputRef.current?.click()}>
              {uploadedImage ? (
                <img src={imagePreview || "/placeholder.svg"} alt="Uploaded Image" className="max-w-full max-h-full" />
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Upload className="w-10 h-10" />
                  <span>Upload an image</span>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg, image/jpg, image/png, image/webp"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Enter additional details or instructions..."
              className="resize-none"
            />
            <Button onClick={handleSubmit} disabled={!isStarted || isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
            </Button>
            <ScrollArea className="flex-grow mt-4">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex mb-4 ${message.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="flex flex-col items-center">
                    {message.type === "user" ? (
                      <User className="w-6 h-6" />
                    ) : message.type === "ai" ? (
                      <Bot className="w-6 h-6" />
                    ) : (
                      <Settings className="w-6 h-6" />
                    )}
                    <div className="max-w-lg">
                      {message.imagePreview && (
                        <img
                          src={message.imagePreview || "/placeholder.svg"}
                          alt="Chat Image"
                          className="w-full h-auto rounded-lg mb-2"
                        />
                      )}
                      <div className="bg-white p-4 rounded-lg shadow-md w-full">
                        <p>{message.content}</p>
                        {message.metadata && (
                          <div className="mt-4">
                            <Badge variant={getSeverityColor(message.metadata.severity_level)}>
                              {getSeverityIcon(message.metadata.severity_level)} {message.metadata.severity_level}
                            </Badge>
                            <Badge variant="secondary">
                              {getCategoryIcon(
                                categories.find((cat) => cat.value === message.metadata.category)?.icon || "settings",
                              )}{" "}
                              {message.metadata.category}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </CardContent>
        <CardFooter className="border-t">
          {systemStats && (
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span>Total Documents: {systemStats.totalDocuments}</span>
              </div>
              <div className="flex items-center gap-2">
                <Square className="w-4 h-4" />
                <span>Categories: {Object.keys(systemStats.categoryCounts).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                <span>Analysis Types: {analysisPrompts.length}</span>
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
