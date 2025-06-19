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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Camera,
  AlertCircle,
  User,
  Bot,
  Loader2,
  Upload,
  Search,
  Wrench,
  Eye,
  Smartphone,
  Monitor,
  Play,
  Square,
  Zap,
  Shield,
  Settings,
} from "lucide-react"

interface ChatMessage {
  id: string
  type: "user" | "ai" | "system"
  content: string
  imagePreview?: string
  metadata?: {
    productType?: string
    analysisType?: string
    similarIssues?: any[]
    matchCount?: number
  }
}

interface ProductType {
  value: string
  label: string
  count: number
}

interface AnalysisPrompt {
  id: string
  name: string
  description: string
  analysis_type: string
}

export default function MultimodalRAGPage() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState("")
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProductType, setSelectedProductType] = useState<string>("general")
  const [analysisType, setAnalysisType] = useState<string>("general")
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [analysisPrompts, setAnalysisPrompts] = useState<AnalysisPrompt[]>([])
  const [isStarted, setIsStarted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Fetch product types and analysis prompts
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch product types
        const typesResponse = await fetch("/api/multimodal-rag/product-types")
        const typesResult = await typesResponse.json()
        if (typesResult.success) {
          setProductTypes([{ value: "general", label: "General", count: 0 }, ...typesResult.productTypes])
        }

        // Fetch analysis prompts
        const promptsResponse = await fetch("/api/multimodal-rag/prompts")
        const promptsResult = await promptsResponse.json()
        if (promptsResult.success) {
          setAnalysisPrompts(promptsResult.prompts)
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
      // Check file size (limit to 10MB)
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
      "🔧 Multimodal RAG troubleshooting system activated! Upload an image of your product issue for AI-powered analysis and solutions from our knowledge base.",
    )
  }

  const handleStop = () => {
    setIsStarted(false)
    setChatMessages([])
    setUploadedImage(null)
    setImagePreview(null)
    setUserInput("")
    setError(null)
  }

  const handleSubmit = async () => {
    if (!uploadedImage) {
      setError("Please upload an image of the product issue for analysis.")
      return
    }

    setIsLoading(true)
    setError(null)

    const userMessageContent = userInput.trim() || "Please analyze this image for troubleshooting."
    const productTypeLabel = productTypes.find((type) => type.value === selectedProductType)?.label || "General"
    const analysisTypeLabel =
      analysisPrompts.find((prompt) => prompt.analysis_type === analysisType)?.description || analysisType

    addMessage(
      "user",
      `${userMessageContent}\n\n📋 Product: ${productTypeLabel}\n🔍 Analysis: ${analysisTypeLabel}`,
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

        const response = await fetch("/api/multimodal-rag/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Image,
            mimeType,
            productType: selectedProductType,
            analysisType,
            chatHistory: historyForApi,
          }),
        })

        const result = await response.json()

        if (result.success) {
          addMessage("ai", result.response, undefined, {
            productType: result.productType,
            analysisType: result.analysisType,
            similarIssues: result.similarIssues,
            matchCount: result.matchCount,
          })

          // Show database match information
          if (result.matchCount > 0) {
            const matchSummary = `🎯 Found ${result.matchCount} similar issue(s) in knowledge base:\n${result.similarIssues
              .slice(0, 3)
              .map(
                (issue: any, index: number) =>
                  `${index + 1}. ${issue.icon_name || issue.title} (${(issue.similarity * 100).toFixed(1)}% match)`,
              )
              .join("\n")}`
            addMessage("system", matchSummary)
          } else {
            addMessage(
              "system",
              "ℹ️ No similar issues found in knowledge base. Analysis based on visual inspection only.",
            )
          }
        } else {
          setError(result.error || "Analysis failed")
          addMessage("ai", `❌ Analysis failed: ${result.error || "Unknown error"}`)
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
      addMessage("ai", `❌ Error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getAnalysisIcon = (type: string) => {
    switch (type) {
      case "indicator":
        return <Zap className="w-4 h-4" />
      case "damage":
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
    <div className="flex flex-col h-screen max-w-5xl mx-auto p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-6 h-6" />
            Multimodal RAG Troubleshooting System
            {isMobile && <Smartphone className="w-4 h-4 text-blue-500" />}
            {!isMobile && <Monitor className="w-4 h-4 text-green-500" />}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-grow p-0">
          {!isStarted ? (
            // Start Screen
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-8">
              <div className="text-center space-y-4">
                <div className="relative">
                  <Wrench className="w-20 h-20 mx-auto text-blue-500" />
                  <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-2">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold">AI-Powered Product Troubleshooting</h2>
                <p className="text-gray-600 max-w-2xl">
                  Advanced multimodal RAG system that analyzes product images, searches our knowledge base using vector
                  similarity, and provides intelligent troubleshooting solutions powered by AI.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl">
                <div className="text-center p-6 border rounded-lg hover:shadow-md transition-shadow">
                  <Camera className="w-10 h-10 mx-auto mb-3 text-blue-500" />
                  <h3 className="font-semibold mb-2">Image Analysis</h3>
                  <p className="text-sm text-gray-600">AI analyzes visual indicators, damage, and component status</p>
                </div>
                <div className="text-center p-6 border rounded-lg hover:shadow-md transition-shadow">
                  <Search className="w-10 h-10 mx-auto mb-3 text-green-500" />
                  <h3 className="font-semibold mb-2">Vector Search</h3>
                  <p className="text-sm text-gray-600">Finds similar issues using 1408-dimension embeddings</p>
                </div>
                <div className="text-center p-6 border rounded-lg hover:shadow-md transition-shadow">
                  <Bot className="w-10 h-10 mx-auto mb-3 text-purple-500" />
                  <h3 className="font-semibold mb-2">AI Solutions</h3>
                  <p className="text-sm text-gray-600">Contextualized responses from knowledge base</p>
                </div>
                <div className="text-center p-6 border rounded-lg hover:shadow-md transition-shadow">
                  <Settings className="w-10 h-10 mx-auto mb-3 text-orange-500" />
                  <h3 className="font-semibold mb-2">Adaptive</h3>
                  <p className="text-sm text-gray-600">Works with existing data and multiple product types</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl">
                <h4 className="font-semibold text-blue-800 mb-2">System Features:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Works with your existing RAG documents database</li>
                  <li>• Google's multimodal embedding for image vectorization</li>
                  <li>• Supabase pgvector for high-performance similarity search</li>
                  <li>• Mobile-optimized UI with 3x enlarged upload area</li>
                  <li>• Dynamic prompts stored in database</li>
                </ul>
              </div>

              <Button onClick={handleStart} size="lg" className="px-12 py-3 text-lg">
                <Play className="w-6 h-6 mr-3" />
                Start Troubleshooting
              </Button>
            </div>
          ) : (
            // Main Interface
            <Tabs defaultValue="troubleshoot" className="flex-grow flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="troubleshoot">Troubleshoot</TabsTrigger>
                <TabsTrigger value="chat">Analysis History</TabsTrigger>
              </TabsList>

              <TabsContent value="troubleshoot" className="flex-grow flex flex-col space-y-6 p-6">
                {/* Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Product Type</label>
                    <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product type" />
                      </SelectTrigger>
                      <SelectContent>
                        {productTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center justify-between w-full">
                              <span>{type.label}</span>
                              {type.count > 0 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {type.count}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Analysis Type</label>
                    <Select value={analysisType} onValueChange={setAnalysisType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {analysisPrompts.map((prompt) => (
                          <SelectItem key={prompt.analysis_type} value={prompt.analysis_type}>
                            <div className="flex items-center gap-2">
                              {getAnalysisIcon(prompt.analysis_type)}
                              <div>
                                <div className="font-medium">{prompt.name.replace(/_/g, " ")}</div>
                                <div className="text-xs text-gray-500">{prompt.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Image Upload Area - Enhanced for mobile */}
                <div className={getUploadAreaClasses()} onClick={() => fileInputRef.current?.click()}>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="space-y-3">
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Preview"
                        className="max-w-full max-h-64 mx-auto rounded-lg shadow-md"
                      />
                      <p className={`text-gray-600 ${isMobile && isStarted ? "text-lg" : "text-sm"}`}>
                        Click to change image
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload
                        className={`mx-auto text-gray-400 ${isMobile && isStarted ? "w-16 h-16" : "w-12 h-12"}`}
                      />
                      <div>
                        <p className={`text-gray-600 font-medium ${isMobile && isStarted ? "text-xl" : "text-base"}`}>
                          Upload Product Image
                        </p>
                        <p className={`text-gray-400 ${isMobile && isStarted ? "text-base" : "text-sm"}`}>
                          JPG, PNG, WebP (max 10MB)
                        </p>
                      </div>
                      {isMobile && isStarted && (
                        <div className="text-blue-600 text-sm font-medium">📱 Enhanced mobile upload area</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional Context Input */}
                <Textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Describe the issue, symptoms, or provide additional context (optional)..."
                  className="resize-none"
                  rows={4}
                  disabled={isLoading}
                />

                {/* Submit Button */}
                <Button onClick={handleSubmit} disabled={isLoading || !uploadedImage} className="w-full" size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Analyzing with RAG system...
                    </>
                  ) : (
                    <>
                      {getAnalysisIcon(analysisType)}
                      <span className="ml-3">Analyze & Search Knowledge Base</span>
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="chat" className="flex-grow flex flex-col">
                <ScrollArea className="flex-grow p-6">
                  <div className="space-y-6">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-4 ${msg.type === "user" ? "justify-end" : ""}`}
                      >
                        {msg.type === "ai" && <Bot className="w-8 h-8 flex-shrink-0 text-blue-500 mt-1" />}
                        {msg.type === "system" && (
                          <AlertCircle className="w-8 h-8 flex-shrink-0 text-orange-500 mt-1" />
                        )}

                        <div
                          className={`p-4 rounded-lg max-w-[85%] ${
                            msg.type === "user"
                              ? "bg-blue-500 text-white"
                              : msg.type === "system"
                                ? "bg-orange-50 text-orange-800 border border-orange-200"
                                : "bg-gray-50 text-gray-800 border"
                          }`}
                        >
                          {msg.imagePreview && (
                            <img
                              src={msg.imagePreview || "/placeholder.svg"}
                              alt="Uploaded preview"
                              className="max-w-sm max-h-48 rounded-md mb-3"
                            />
                          )}
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                          {msg.metadata?.similarIssues && msg.metadata.similarIssues.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-sm font-medium">Similar Issues Found:</div>
                              <div className="flex flex-wrap gap-2">
                                {msg.metadata.similarIssues.slice(0, 3).map((issue: any, index: number) => (
                                  <Badge
                                    key={index}
                                    variant={getSeverityColor(issue.severity_level) as any}
                                    className="text-xs"
                                  >
                                    {issue.icon_name || issue.title} ({(issue.similarity * 100).toFixed(1)}%)
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {msg.type === "user" && <User className="w-8 h-8 flex-shrink-0 text-gray-500 mt-1" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>

        {isStarted && (
          <CardFooter className="border-t p-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center w-full">
              <div className="text-sm text-gray-600">
                <span className="font-medium">
                  {productTypes.find((type) => type.value === selectedProductType)?.label || "General"}
                </span>
                {" • "}
                <span>
                  {analysisPrompts.find((prompt) => prompt.analysis_type === analysisType)?.name || analysisType}
                </span>
              </div>
              <Button onClick={handleStop} variant="outline">
                <Square className="w-4 h-4 mr-2" />
                End Session
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
