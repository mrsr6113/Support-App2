"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Coffee, Camera, Send, AlertCircle, User, Bot, Loader2 } from "lucide-react"

interface ChatMessage {
  id: string
  type: "user" | "ai"
  content: string
  imagePreview?: string // For user messages with images
}

export default function CoffeeMakerTroubleshootPage() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState("")
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null) // Clear previous errors
    }
  }

  const addMessage = (type: "user" | "ai", content: string, imgPreview?: string) => {
    setChatMessages((prev) => [...prev, { id: Date.now().toString(), type, content, imagePreview: imgPreview }])
  }

  const handleSubmit = async () => {
    if (!uploadedImage && !userInput.trim()) {
      setError("Please upload an image or type a message.")
      return
    }
    if (!uploadedImage) {
      setError("Please upload an image of the coffee maker panel for analysis.")
      return
    }

    setIsLoading(true)
    setError(null)

    const userMessageContent = userInput.trim() || "Please analyze this image."
    addMessage("user", userMessageContent, imagePreview || undefined)
    setUserInput("") // Clear input after sending

    try {
      const reader = new FileReader()
      reader.readAsDataURL(uploadedImage)
      reader.onloadend = async () => {
        const base64Image = (reader.result as string).split(",")[1]
        const mimeType = uploadedImage.type

        const historyForApi = chatMessages
          .filter((msg) => msg.type === "user" || msg.type === "ai") // Exclude system messages if any
          .map((msg) => ({
            role: msg.type === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          }))

        const response = await fetch("/api/troubleshoot-coffee-maker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64Image,
            mimeType,
            chatHistory: historyForApi,
          }),
        })

        const result = await response.json()

        if (result.success) {
          addMessage("ai", result.response)
          // Optionally display matchedIssue details if needed for debugging or UI
          // console.log("Matched Issue:", result.matchedIssue);
        } else {
          setError(result.error || "An unknown error occurred.")
          addMessage("ai", `Sorry, I encountered an error: ${result.error || "Unknown error"}`)
        }
        // Reset image after successful processing for next interaction
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

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Coffee /> Coffee Maker Troubleshooter
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow p-0">
          <ScrollArea className="h-[calc(100vh-280px)] p-4 space-y-4">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex items-start gap-3 ${msg.type === "user" ? "justify-end" : ""}`}>
                {msg.type === "ai" && <Bot className="w-6 h-6 flex-shrink-0 text-blue-500" />}
                <div
                  className={`p-3 rounded-lg max-w-[80%] ${
                    msg.type === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"
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
                </div>
                {msg.type === "user" && <User className="w-6 h-6 flex-shrink-0 text-gray-500" />}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
        <CardFooter className="border-t p-4">
          {error && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {imagePreview && (
            <div className="mb-2 relative w-24 h-24">
              <img
                src={imagePreview || "/placeholder.svg"}
                alt="Preview"
                className="rounded-md w-full h-full object-cover"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                onClick={() => {
                  setImagePreview(null)
                  setUploadedImage(null)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              >
                X
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 w-full">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
              <Camera className="w-4 h-4" />
            </Button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Describe any additional details (optional)..."
              className="flex-grow resize-none"
              rows={1}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              disabled={isLoading}
            />
            <Button onClick={handleSubmit} disabled={isLoading || !uploadedImage}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
