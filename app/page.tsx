"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertCircle,
  User,
  Bot,
  Loader2,
  Camera,
  Monitor,
  Play,
  Square,
  Mic,
  MicOff,
  Volume2,
  Settings,
  Upload,
  Save,
  Database,
  ImageIcon,
  Link,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  Send,
  X,
} from "lucide-react"

interface ChatMessage {
  id: string
  type: "user" | "ai" | "system"
  content: string
  imageData?: string
  timestamp: Date
  isVoice?: boolean
  metadata?: {
    analysisType?: string
    processingTime?: number
    confidence?: number
    linkedRAGEntry?: string
  }
}

interface RAGDocument {
  id: string
  title: string
  content: string
  icon_name?: string
  icon_description?: string
  category: string
  tags: string[]
  image_url?: string
  created_at: string
}

interface SystemPrompt {
  id: string
  name: string
  prompt: string
  is_default: boolean
}

const CATEGORIES = [
  { value: "general", label: "一般" },
  { value: "coffee_maker", label: "コーヒーメーカー" },
  { value: "maintenance", label: "メンテナンス" },
  { value: "troubleshooting", label: "トラブルシューティング" },
  { value: "safety", label: "安全" },
  { value: "cleaning", label: "清掃" },
  { value: "parts", label: "部品" },
  { value: "indicators", label: "インジケーター" },
  { value: "water_system", label: "給水システム" },
  { value: "brewing", label: "抽出" },
  { value: "electrical", label: "電気系統" },
  { value: "mechanical", label: "機械系統" },
]

export default function AIVisionChatPage() {
  // Core state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Media state
  const [inputMode, setInputMode] = useState<"camera" | "screen">("camera")
  const [isStarted, setIsStarted] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Analysis settings
  const [analysisFrequency, setAnalysisFrequency] = useState<number>(10)
  const [systemPrompt, setSystemPrompt] = useState("coffee_maker_expert")
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
  const [isAutoAnalysis, setIsAutoAnalysis] = useState(false)

  // Voice state
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  // RAG state
  const [ragDocuments, setRAGDocuments] = useState<RAGDocument[]>([])
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([])
  const [selectedRAGEntry, setSelectedRAGEntry] = useState<string>("none")
  const [editingRAGEntry, setEditingRAGEntry] = useState<RAGDocument | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newRAGEntry, setNewRAGEntry] = useState({
    title: "",
    content: "",
    iconName: "",
    iconDescription: "",
    category: "general",
    tags: "",
    image: null as File | null,
  })

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ragImageInputRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)

  // Mobile detection
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

  // Load data
  useEffect(() => {
    loadRAGDocuments()
    loadSystemPrompts()
  }, [])

  // Set default system prompt
  useEffect(() => {
    if (systemPrompts.length > 0) {
      const defaultPrompt = systemPrompts.find((p) => p.is_default)
      if (defaultPrompt) {
        setSystemPrompt(defaultPrompt.id)
      }
    }
  }, [systemPrompts])

  const loadRAGDocuments = async () => {
    try {
      const response = await fetch("/api/supabase/rag-documents")
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setRAGDocuments(result.documents || [])
        }
      }
    } catch (error) {
      console.error("Failed to load RAG documents:", error)
    }
  }

  const loadSystemPrompts = async () => {
    try {
      const response = await fetch("/api/supabase/system-prompts")
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSystemPrompts(result.prompts || [])
        }
      }
    } catch (error) {
      console.error("Failed to load system prompts:", error)
    }
  }

  // Camera functions
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: isMobile ? 1280 : 1920 },
          height: { ideal: isMobile ? 720 : 1080 },
        },
        audio: false,
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      setStream(mediaStream)
      addMessage("system", "📷 カメラを開始しました。")

      if (isAutoAnalysis) {
        startPeriodicAnalysis()
      }
    } catch (error) {
      console.error("Camera access failed:", error)
      setError("カメラにアクセスできませんでした。ブラウザの設定を確認してください。")
    }
  }

  const startScreenShare = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      setStream(mediaStream)
      addMessage("system", "🖥️ 画面共有を開始しました。")

      if (isAutoAnalysis) {
        startPeriodicAnalysis()
      }

      // Handle stream end
      mediaStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopCapture()
      })
    } catch (error) {
      console.error("Screen share failed:", error)
      setError("画面共有を開始できませんでした。")
    }
  }

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsStarted(false)
    stopPeriodicAnalysis()
    addMessage("system", "キャプチャを停止しました。")
  }

  // Analysis functions
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    return canvas.toDataURL("image/jpeg", 0.8)
  }

  const startPeriodicAnalysis = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      if (!isLoading) {
        handleAnalyze(true)
      }
    }, analysisFrequency * 1000)
  }

  const stopPeriodicAnalysis = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Message functions
  const addMessage = (
    type: "user" | "ai" | "system",
    content: string,
    imageData?: string,
    metadata?: any,
    isVoice?: boolean,
  ) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      imageData,
      timestamp: new Date(),
      isVoice,
      metadata,
    }

    setChatMessages((prev) => [...prev, message])

    if (type === "ai" && isVoiceEnabled) {
      speakText(content)
    }
  }

  const speakText = async (text: string) => {
    if (!isVoiceEnabled || isSpeaking) return

    try {
      setIsSpeaking(true)

      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }

        await audio.play()
      } else {
        setIsSpeaking(false)
      }
    } catch (error) {
      console.error("Text-to-speech error:", error)
      setIsSpeaking(false)
    }
  }

  // Analysis function
  const handleAnalyze = async (isAutomatic = false) => {
    const imageData = captureFrame()
    if (!imageData) {
      if (!isAutomatic) {
        setError("画像をキャプチャできませんでした。")
      }
      return
    }

    setIsLoading(true)
    setError(null)

    const prompt = userInput.trim() || "この画像を分析してください。"

    if (!isAutomatic) {
      addMessage("user", prompt, imageData, {
        analysisType: systemPrompt,
        linkedRAGEntry: selectedRAGEntry,
      })
      setUserInput("")
    }

    try {
      const base64Image = imageData.split(",")[1]

      const response = await fetch("/api/generic-rag/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType: "image/jpeg",
          category: "coffee_maker",
          analysisType: systemPrompt,
          chatHistory: chatMessages
            .filter((msg) => msg.type === "user" || msg.type === "ai")
            .slice(-10)
            .map((msg) => ({
              role: msg.type === "user" ? "user" : "model",
              parts: [{ text: msg.content }],
            })),
          linkedRAGEntry: selectedRAGEntry,
        }),
      })

      const result = await response.json()

      if (result.success) {
        addMessage("ai", result.response, undefined, {
          analysisType: systemPrompt,
          processingTime: result.processingTimeMs,
          confidence: result.confidence,
          linkedRAGEntry: selectedRAGEntry,
        })
      } else {
        if (!isAutomatic) {
          setError(result.error || "分析に失敗しました。")
        }
      }
    } catch (error) {
      if (!isAutomatic) {
        console.error("Analysis error:", error)
        setError("分析中にエラーが発生しました。")
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Send message function
  const handleSendMessage = () => {
    if (!userInput.trim() || isLoading) return

    if (isStarted) {
      handleAnalyze()
    } else {
      // Text-only chat
      addMessage("user", userInput.trim())
      setUserInput("")
      // Add AI response logic here if needed
    }
  }

  // RAG functions
  const handleRAGImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      if (!validTypes.includes(file.type)) {
        setError("サポートされていない画像形式です。JPG、PNG、WebPを使用してください。")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("画像ファイルサイズは10MB以下にしてください。")
        return
      }

      if (editingRAGEntry) {
        setEditingRAGEntry((prev) => ({ ...prev!, image: file }) as any)
      } else {
        setNewRAGEntry((prev) => ({ ...prev, image: file }))
      }
      setError(null)
    }
  }

  const saveRAGEntry = async () => {
    const entry = editingRAGEntry || newRAGEntry
    if (!entry.title || !entry.content) {
      setError("タイトルと内容は必須です。")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      let imageBase64 = null
      let mimeType = null

      if (entry.image) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const result = reader.result as string
            resolve(result.split(",")[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(entry.image!)
        })
        imageBase64 = base64
        mimeType = entry.image.type
      }

      const tags = entry.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)

      const requestData = {
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags,
        iconName: entry.iconName || entry.title,
        iconDescription: entry.iconDescription || entry.content,
        imageBase64,
        mimeType,
      }

      let response
      if (editingRAGEntry) {
        // Update existing document
        response = await fetch("/api/supabase/rag-documents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRAGEntry.id, ...requestData }),
        })
      } else {
        // Create new document
        response = await fetch("/api/supabase/rag-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        })
      }

      const result = await response.json()

      if (result.success) {
        addMessage("system", `✅ RAG文書「${entry.title}」を${editingRAGEntry ? "更新" : "追加"}しました。`)

        // Reset form
        if (editingRAGEntry) {
          setEditingRAGEntry(null)
          setIsEditDialogOpen(false)
        } else {
          setNewRAGEntry({
            title: "",
            content: "",
            iconName: "",
            iconDescription: "",
            category: "general",
            tags: "",
            image: null,
          })
        }

        if (ragImageInputRef.current) ragImageInputRef.current.value = ""
        loadRAGDocuments()
      } else {
        setError(result.error || "RAG文書の保存に失敗しました。")
      }
    } catch (error) {
      console.error("RAG save error:", error)
      setError("RAG文書の保存中にエラーが発生しました。")
    } finally {
      setIsLoading(false)
    }
  }

  const deleteRAGEntry = async (id: string) => {
    if (!confirm("この文書を削除しますか？")) return

    try {
      const response = await fetch(`/api/supabase/rag-documents?id=${id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        addMessage("system", "✅ RAG文書を削除しました。")
        loadRAGDocuments()
      } else {
        setError(result.error || "RAG文書の削除に失敗しました。")
      }
    } catch (error) {
      console.error("RAG delete error:", error)
      setError("RAG文書の削除中にエラーが発生しました。")
    }
  }

  const startEditRAGEntry = (doc: RAGDocument) => {
    setEditingRAGEntry({
      ...doc,
      tags: doc.tags.join(", "),
      image: null,
    } as any)
    setIsEditDialogOpen(true)
  }

  // Main control functions
  const handleStart = async () => {
    setIsStarted(true)
    addMessage("system", "🚀 AI Vision Chatを開始しました。")

    if (inputMode === "camera") {
      await startCamera()
    } else {
      await startScreenShare()
    }
  }

  const handleStop = () => {
    stopCapture()
    setChatMessages([])
    setUserInput("")
    setError(null)
  }

  // Calculate video area size - much larger on mobile when started
  const getVideoAreaClasses = () => {
    if (!isStarted) {
      return "w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center"
    }

    if (isMobile) {
      // On mobile, make video area much larger when started
      return "w-full h-[70vh] bg-black rounded-lg overflow-hidden transform scale-105 origin-center mb-4"
    } else {
      // Desktop size
      return "w-full h-64 bg-black rounded-lg overflow-hidden"
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-6 h-6" />
            AI Vision Chat
            <Badge variant="secondary" className="ml-2">
              Supabase
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col p-4">
          <Tabs defaultValue="chat" className="flex-grow flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat">チャット</TabsTrigger>
              <TabsTrigger value="settings">設定</TabsTrigger>
              <TabsTrigger value="rag">RAG文書管理</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-grow flex flex-col space-y-4">
              {/* Input Mode Selection */}
              <div className="flex items-center space-x-4">
                <RadioGroup
                  value={inputMode}
                  onValueChange={(value: "camera" | "screen") => setInputMode(value)}
                  className="flex flex-row space-x-4"
                  disabled={isStarted}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="camera" id="camera" />
                    <Label htmlFor="camera" className="flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      カメラ
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="screen" id="screen" />
                    <Label htmlFor="screen" className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      画面共有
                    </Label>
                  </div>
                </RadioGroup>

                <div className="flex gap-2 ml-auto">
                  {!isStarted ? (
                    <Button onClick={handleStart} className="bg-green-600 hover:bg-green-700">
                      <Play className="w-4 h-4 mr-2" />
                      開始
                    </Button>
                  ) : (
                    <Button onClick={handleStop} variant="destructive">
                      <Square className="w-4 h-4 mr-2" />
                      停止
                    </Button>
                  )}
                </div>
              </div>

              {/* Video Area */}
              <div className={getVideoAreaClasses()}>
                {isStarted ? (
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                ) : (
                  <div className="text-gray-500 text-center">
                    <div className="mb-2">
                      {inputMode === "camera" ? (
                        <Camera className="w-12 h-12 mx-auto mb-2" />
                      ) : (
                        <Monitor className="w-12 h-12 mx-auto mb-2" />
                      )}
                    </div>
                    <p>開始ボタンを押して{inputMode === "camera" ? "カメラ" : "画面共有"}を開始</p>
                  </div>
                )}
              </div>

              {/* RAG Entry Selection */}
              {ragDocuments.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="rag-select" className="text-sm font-medium">
                    関連RAG文書:
                  </Label>
                  <Select value={selectedRAGEntry} onValueChange={setSelectedRAGEntry}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="関連文書を選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">なし</SelectItem>
                      {ragDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          <div className="flex items-center gap-2">
                            <Link className="w-4 h-4" />
                            {doc.title}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Chat Messages */}
              <ScrollArea className="flex-grow border rounded-lg p-4 min-h-[200px]">
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.type === "user"
                            ? "bg-blue-500 text-white"
                            : message.type === "ai"
                              ? "bg-gray-100 text-gray-900"
                              : "bg-yellow-100 text-yellow-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {message.type === "user" ? (
                            <User className="w-4 h-4" />
                          ) : message.type === "ai" ? (
                            <Bot className="w-4 h-4" />
                          ) : (
                            <Settings className="w-4 h-4" />
                          )}
                          <span className="text-xs opacity-70">{message.timestamp.toLocaleTimeString()}</span>
                          {message.isVoice && <Mic className="w-3 h-3" />}
                          {message.metadata?.linkedRAGEntry && (
                            <Badge variant="outline" className="text-xs">
                              <Link className="w-3 h-3 mr-1" />
                              RAG連携
                            </Badge>
                          )}
                        </div>
                        {message.imageData && (
                          <img
                            src={message.imageData || "/placeholder.svg"}
                            alt="Captured frame"
                            className="w-full max-w-sm rounded mb-2"
                          />
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.metadata?.processingTime && (
                          <div className="text-xs opacity-70 mt-1">処理時間: {message.metadata.processingTime}ms</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="flex gap-2">
                <Textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="メッセージを入力..."
                  className="flex-grow resize-none"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleSendMessage}
                    disabled={!userInput.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                  <Button onClick={isListening ? () => {} : () => {}} variant="outline" disabled={!isStarted}>
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="frequency">分析頻度 (秒)</Label>
                  <Select
                    value={analysisFrequency.toString()}
                    onValueChange={(value) => setAnalysisFrequency(Number.parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5秒</SelectItem>
                      <SelectItem value="10">10秒</SelectItem>
                      <SelectItem value="20">20秒</SelectItem>
                      <SelectItem value="30">30秒</SelectItem>
                      <SelectItem value="60">60秒</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="prompt">システムプロンプト</Label>
                  <Select value={systemPrompt} onValueChange={setSystemPrompt}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {systemPrompts.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          <div className="flex items-center gap-2">
                            {prompt.name}
                            {prompt.is_default && (
                              <Badge variant="default" className="text-xs">
                                デフォルト
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="auto-analysis"
                    checked={isAutoAnalysis}
                    onChange={(e) => setIsAutoAnalysis(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="auto-analysis">自動分析</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="voice-enabled"
                    checked={isVoiceEnabled}
                    onChange={(e) => setIsVoiceEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="voice-enabled">音声読み上げ</Label>
                  {isSpeaking && <Volume2 className="w-4 h-4 text-blue-500" />}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rag" className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  RAG文書管理 (Supabase)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="rag-title">文書タイトル</Label>
                    <Input
                      id="rag-title"
                      value={newRAGEntry.title}
                      onChange={(e) => setNewRAGEntry((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="例: 警告アイコン対応手順"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rag-category">カテゴリ</Label>
                    <Select
                      value={newRAGEntry.category}
                      onValueChange={(value) => setNewRAGEntry((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="rag-icon-name">アイコン名</Label>
                    <Input
                      id="rag-icon-name"
                      value={newRAGEntry.iconName}
                      onChange={(e) => setNewRAGEntry((prev) => ({ ...prev, iconName: e.target.value }))}
                      placeholder="例: 警告ランプ"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rag-tags">タグ (カンマ区切り)</Label>
                    <Input
                      id="rag-tags"
                      value={newRAGEntry.tags}
                      onChange={(e) => setNewRAGEntry((prev) => ({ ...prev, tags: e.target.value }))}
                      placeholder="例: 警告, ランプ, 赤色"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <Label htmlFor="rag-icon-description">アイコン説明</Label>
                  <Textarea
                    id="rag-icon-description"
                    value={newRAGEntry.iconDescription}
                    onChange={(e) => setNewRAGEntry((prev) => ({ ...prev, iconDescription: e.target.value }))}
                    placeholder="アイコンの詳細な説明を入力..."
                    rows={2}
                  />
                </div>

                <div className="mb-4">
                  <Label htmlFor="rag-content">文書内容</Label>
                  <Textarea
                    id="rag-content"
                    value={newRAGEntry.content}
                    onChange={(e) => setNewRAGEntry((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="トラブルシューティング手順や解決方法を詳しく記述..."
                    rows={4}
                  />
                </div>

                <div className="mb-4">
                  <Label htmlFor="rag-image">参考画像</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => ragImageInputRef.current?.click()}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      画像を選択
                    </Button>
                    {newRAGEntry.image && <span className="text-sm text-gray-600">{newRAGEntry.image.name}</span>}
                  </div>
                  <input
                    ref={ragImageInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleRAGImageUpload}
                    className="hidden"
                  />
                </div>

                <Button onClick={saveRAGEntry} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  RAG文書を保存
                </Button>
              </div>

              {/* Existing RAG Documents */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  登録済みRAG文書 ({ragDocuments.length}件)
                </h4>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {ragDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            <span className="font-medium">{doc.title}</span>
                            <Badge variant="outline">{doc.category}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{doc.content.substring(0, 100)}...</p>
                          {doc.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {doc.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setSelectedRAGEntry(selectedRAGEntry === doc.id ? "none" : doc.id)}
                            variant={selectedRAGEntry === doc.id ? "default" : "outline"}
                            size="sm"
                          >
                            {selectedRAGEntry === doc.id ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Link className="w-4 h-4" />
                            )}
                          </Button>
                          <Button onClick={() => startEditRAGEntry(doc)} variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button onClick={() => deleteRAGEntry(doc.id)} variant="outline" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit RAG Document Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              RAG文書を編集
            </DialogTitle>
          </DialogHeader>
          {editingRAGEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-title">文書タイトル</Label>
                  <Input
                    id="edit-title"
                    value={editingRAGEntry.title}
                    onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">カテゴリ</Label>
                  <Select
                    value={editingRAGEntry.category}
                    onValueChange={(value) => setEditingRAGEntry((prev) => ({ ...prev!, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-icon-name">アイコン名</Label>
                  <Input
                    id="edit-icon-name"
                    value={editingRAGEntry.icon_name || ""}
                    onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, icon_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-tags">タグ (カンマ区切り)</Label>
                  <Input
                    id="edit-tags"
                    value={(editingRAGEntry as any).tags}
                    onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, tags: e.target.value }) as any)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-icon-description">アイコン説明</Label>
                <Textarea
                  id="edit-icon-description"
                  value={editingRAGEntry.icon_description || ""}
                  onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, icon_description: e.target.value }))}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="edit-content">文書内容</Label>
                <Textarea
                  id="edit-content"
                  value={editingRAGEntry.content}
                  onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, content: e.target.value }))}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="edit-image">新しい画像 (任意)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => ragImageInputRef.current?.click()}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    画像を選択
                  </Button>
                  {(editingRAGEntry as any).image && (
                    <span className="text-sm text-gray-600">{(editingRAGEntry as any).image.name}</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveRAGEntry} disabled={isLoading} className="flex-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  更新
                </Button>
                <Button
                  onClick={() => {
                    setEditingRAGEntry(null)
                    setIsEditDialogOpen(false)
                  }}
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-2" />
                  キャンセル
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
