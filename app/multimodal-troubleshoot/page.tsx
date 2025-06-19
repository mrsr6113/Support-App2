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
} from "lucide-react"

interface ChatMessage {
  id: string
  type: "user" | "ai" | "system"
  content: string
  imagePreview?: string
  metadata?: {
    productCategory?: string
    analysisType?: string
    matchedIssues?: any[]
  }
}

interface ProductCategory {
  id: string
  category_name: string
  display_name: string
  description: string
  icon_name: string
}

export default function MultimodalTroubleshootPage() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState("")
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [analysisType, setAnalysisType] = useState<string>("general")
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([])
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

  // Fetch product categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/product-categories")
        const result = await response.json()
        if (result.success) {
          setProductCategories(result.categories)
        }
      } catch (error) {
        console.error("Failed to fetch product categories:", error)
      }
    }

    fetchCategories()
  }, [])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
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
      "🔧 Multimodal troubleshooting system activated! Upload an image of your product issue to get started.",
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
    const categoryName =
      productCategories.find((cat) => cat.category_name === selectedCategory)?.display_name || "General"

    addMessage(
      "user",
      `${userMessageContent} (Category: ${categoryName}, Analysis: ${analysisType})`,
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

        const response = await fetch("/api/multimodal-troubleshoot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Image,
            mimeType,
            productCategory: selectedCategory || "general",
            analysisType,
            chatHistory: historyForApi,
          }),
        })

        const result = await response.json()

        if (result.success) {
          addMessage("ai", result.response, undefined, {
            productCategory: result.productCategory,
            analysisType,
            matchedIssues: result.matchedIssues,
          })

          // Show matched issues if any
          if (result.matchedIssues && result.matchedIssues.length > 0) {
            const issuesSummary = result.matchedIssues
              .map(
                (issue: any, index: number) =>
                  `${index + 1}. ${issue.icon_name} (${(issue.similarity * 100).toFixed(1)}% match)`,
              )
              .join("\n")
            addMessage(
              "system",
              `🔍 Found ${result.matchedIssues.length} similar issue(s) in database:\n${issuesSummary}`,
            )
          }
        } else {
          setError(result.error || "An unknown error occurred.")
          addMessage("ai", `Sorry, I encountered an error: ${result.error || "Unknown error"}`)
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
      addMessage("ai", `Sorry, I encountered an error: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getAnalysisIcon = (type: string) => {
    switch (type) {
      case "detailed":
        return <Search className="w-4 h-4" />
      case "damage":
        return <AlertCircle className="w-4 h-4" />
      default:
        return <Eye className="w-4 h-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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

  // Calculate upload area size based on mobile and started state
  const getUploadAreaClasses = () => {
    const baseClasses =
      "border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-all"

    if (isMobile && isStarted) {
      return `${baseClasses} min-h-[300px] scale-150 transform origin-top` // 3x larger on mobile when started
    } else if (isMobile) {
      return `${baseClasses} min-h-[100px]`
    } else {
      return `${baseClasses} min-h-[150px]`
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-6 h-6" />
            Multimodal Product Troubleshooting System
            {isMobile && <Smartphone className="w-4 h-4 text-blue-500" />}
            {!isMobile && <Monitor className="w-4 h-4 text-green-500" />}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-grow p-0">
          {!isStarted ? (
            // Start Screen
            <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
              <div className="text-center space-y-4">
                <Wrench className="w-16 h-16 mx-auto text-blue-500" />
                <h2 className="text-2xl font-bold">AI-Powered Product Troubleshooting</h2>
                <p className="text-gray-600 max-w-md">
                  Upload images of product issues, indicators, or damage for intelligent analysis and troubleshooting
                  solutions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                <div className="text-center p-4 border rounded-lg">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-semibold">Image Analysis</h3>
                  <p className="text-sm text-gray-600">AI analyzes visual indicators and damage</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Search className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <h3 className="font-semibold">Smart Matching</h3>
                  <p className="text-sm text-gray-600">Finds similar issues in knowledge base</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <h3 className="font-semibold">AI Solutions</h3>
                  <p className="text-sm text-gray-600">Provides step-by-step troubleshooting</p>
                </div>
              </div>

              <Button onClick={handleStart} size="lg" className="px-8">
                <Play className="w-5 h-5 mr-2" />
                Start Troubleshooting
              </Button>
            </div>
          ) : (
            // Main Interface
            <Tabs defaultValue="troubleshoot" className="flex-grow flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="troubleshoot">Troubleshoot</TabsTrigger>
                <TabsTrigger value="chat">Chat History</TabsTrigger>
              </TabsList>

              <TabsContent value="troubleshoot" className="flex-grow flex flex-col space-y-4 p-4">
                {/* Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Product Category</label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {productCategories.map((category) => (
                          <SelectItem key={category.id} value={category.category_name}>
                            {category.display_name}
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
                        <SelectItem value="general">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            General Analysis
                          </div>
                        </SelectItem>
                        <SelectItem value="detailed">
                          <div className="flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Detailed Indicators
                          </div>
                        </SelectItem>
                        <SelectItem value="damage">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Damage Assessment
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Image Upload Area - Enlarged on mobile when started */}
                <div className={getUploadAreaClasses()} onClick={() => fileInputRef.current?.click()}>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  {imagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Preview"
                        className="max-w-full max-h-48 mx-auto rounded-lg"
                      />
                      <p className="text-sm text-gray-600">Click to change image</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className={`mx-auto ${isMobile && isStarted ? "w-12 h-12" : "w-8 h-8"} text-gray-400`} />
                      <p className={`text-gray-600 ${isMobile && isStarted ? "text-lg" : "text-sm"}`}>
                        Click to upload product image
                      </p>
                      <p className={`text-gray-400 ${isMobile && isStarted ? "text-base" : "text-xs"}`}>
                        JPG, PNG, or WebP
                      </p>
                    </div>
                  )}
                </div>

                {/* Additional Input */}
                <Textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Describe the issue or provide additional context (optional)..."
                  className="resize-none"
                  rows={3}
                  disabled={isLoading}
                />

                {/* Submit Button */}
                <Button onClick={handleSubmit} disabled={isLoading || !uploadedImage} className="w-full" size="lg">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      {getAnalysisIcon(analysisType)}
                      <span className="ml-2">Analyze & Troubleshoot</span>
                    </>
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="chat" className="flex-grow flex flex-col">
                <ScrollArea className="flex-grow p-4">
                  <div className="space-y-4">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 ${msg.type === "user" ? "justify-end" : ""}`}
                      >
                        {msg.type === "ai" && <Bot className="w-6 h-6 flex-shrink-0 text-blue-500" />}
                        {msg.type === "system" && <AlertCircle className="w-6 h-6 flex-shrink-0 text-orange-500" />}

                        <div
                          className={`p-3 rounded-lg max-w-[80%] ${
                            msg.type === "user"
                              ? "bg-blue-500 text-white"
                              : msg.type === "system"
                                ? "bg-orange-100 text-orange-800 border border-orange-200"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {msg.imagePreview && (
                            <img
                              src={msg.imagePreview || "/placeholder.svg"}
                              alt="Uploaded preview"
                              className="max-w-xs max-h-48 rounded-md mb-2"
                            />
                          )}
                          <p className="whitespace-pre-wrap">{msg.content}</p>

                          {msg.metadata?.matchedIssues && msg.metadata.matchedIssues.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {msg.metadata.matchedIssues.map((issue: any, index: number) => (
                                <Badge
                                  key={index}
                                  variant={getSeverityColor(issue.severity_level) as any}
                                  className="mr-1"
                                >
                                  {issue.icon_name} ({(issue.similarity * 100).toFixed(1)}%)
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {msg.type === "user" && <User className="w-6 h-6 flex-shrink-0 text-gray-500" />}
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
              <Alert variant="destructive" className="mb-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center w-full">
              <div className="text-sm text-gray-600">
                {selectedCategory && (
                  <span>
                    Category:{" "}
                    {productCategories.find((cat) => cat.category_name === selectedCategory)?.display_name || "General"}
                  </span>
                )}
              </div>
              <Button onClick={handleStop} variant="outline">
                <Square className="w-4 h-4 mr-2" />
                Stop Session
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
