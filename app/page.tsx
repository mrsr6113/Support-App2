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
  Eye,
  Database,
  ImageIcon,
  Link,
  CheckCircle,
  Plus,
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

interface CameraState {
  isActive: boolean
  stream: MediaStream | null
  isRecording: boolean
  facingMode: "user" | "environment"
}

interface ScreenShareState {
  isActive: boolean
  stream: MediaStream | null
}

export default function AIVisionChatPage() {
  // Core state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Media state
  const [inputMode, setInputMode] = useState<"camera" | "screen">("camera")
  const [cameraState, setCameraState] = useState<CameraState>({
    isActive: false,
    stream: null,
    isRecording: false,
    facingMode: "environment",
  })
  const [screenShareState, setScreenShareState] = useState<ScreenShareState>({
    isActive: false,
    stream: null,
  })

  // Analysis settings
  const [analysisFrequency, setAnalysisFrequency] = useState<number>(10)
  const [systemPrompt, setSystemPrompt] = useState("general_assistant")
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
  const [isAutoAnalysis, setIsAutoAnalysis] = useState(false)

  // Voice state
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  const [isStarted, setIsStarted] = useState(false)

  // RAG state
  const [ragDocuments, setRAGDocuments] = useState<RAGDocument[]>([])
  const [selectedRAGEntry, setSelectedRAGEntry] = useState<string>("none")
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
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // Load RAG documents
  useEffect(() => {
    loadRAGDocuments()
  }, [])

  const loadRAGDocuments = async () => {
    try {
      const response = await fetch("/api/generic-rag/categories")
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          // Also load actual documents
          const docsResponse = await fetch("/api/supabase/rag-documents")
          if (docsResponse.ok) {
            const docsResult = await docsResponse.json()
            if (docsResult.success) {
              setRAGDocuments(docsResult.documents || [])
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to load RAG documents:", error)
    }
  }

  // Camera functions
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: cameraState.facingMode,
          width: { ideal: isMobile ? 1280 : 1920 },
          height: { ideal: isMobile ? 720 : 1080 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraState((prev) => ({ ...prev, isActive: true, stream }))
      addMessage("system", "📷 カメラを開始しました。(リアカメラ使用中)")

      if (isAutoAnalysis) {
        startPeriodicAnalysis()
      }
    } catch (error) {
      console.error("Camera access failed:", error)
      setError("カメラにアクセスできませんでした。ブラウザの設定を確認してください。")
    }
  }

  const stopCamera = () => {
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach((track) => track.stop())
    }
    setCameraState({ isActive: false, stream: null, isRecording: false, facingMode: "environment" })
    stopPeriodicAnalysis()
    addMessage("system", "📷 カメラを停止しました。")
  }

  const switchCamera = async () => {
    const newFacingMode = cameraState.facingMode === "user" ? "environment" : "user"
    setCameraState((prev) => ({ ...prev, facingMode: newFacingMode }))

    if (cameraState.isActive) {
      stopCamera()
      setTimeout(() => {
        setCameraState((prev) => ({ ...prev, facingMode: newFacingMode }))
        startCamera()
      }, 100)
    }
  }

  // Screen share functions
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setScreenShareState({ isActive: true, stream })
      addMessage("system", "🖥️ 画面共有を開始しました。")

      if (isAutoAnalysis) {
        startPeriodicAnalysis()
      }

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopScreenShare()
      })
    } catch (error) {
      console.error("Screen share failed:", error)
      setError("画面共有を開始できませんでした。")
    }
  }

  const stopScreenShare = () => {
    if (screenShareState.stream) {
      screenShareState.stream.getTracks().forEach((track) => track.stop())
    }
    setScreenShareState({ isActive: false, stream: null })
    stopPeriodicAnalysis()
    addMessage("system", "🖥️ 画面共有を停止しました。")
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

  // Voice functions
  const startVoiceRecognition = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("音声認識がサポートされていません。")
      return
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "ja-JP"

    recognition.onstart = () => {
      setIsListening(true)
      addMessage("system", "🎤 音声入力を開始しました。話してください。")
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setUserInput(transcript)
      addMessage("user", `🎤 ${transcript}`, undefined, undefined, true)
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error)
      setError(`音声認識エラー: ${event.error}`)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
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
          category: "general",
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

      setNewRAGEntry((prev) => ({ ...prev, image: file }))
      setError(null)
    }
  }

  const saveRAGEntry = async () => {
    if (!newRAGEntry.title || !newRAGEntry.content || !newRAGEntry.image) {
      setError("タイトル、内容、画像は必須です。")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Convert image to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(",")[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(newRAGEntry.image!)
      })

      const response = await fetch("/api/generic-rag/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              image: base64,
              mimeType: newRAGEntry.image!.type,
              iconName: newRAGEntry.iconName || newRAGEntry.title,
              iconDescription: newRAGEntry.iconDescription || newRAGEntry.content,
              content: newRAGEntry.content,
              category: newRAGEntry.category,
              tags: newRAGEntry.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            },
          ],
        }),
      })

      const result = await response.json()

      if (result.success) {
        addMessage("system", `✅ RAG文書「${newRAGEntry.title}」をSupabaseに追加しました。`)
        setNewRAGEntry({
          title: "",
          content: "",
          iconName: "",
          iconDescription: "",
          category: "general",
          tags: "",
          image: null,
        })
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
    setIsStarted(false)
    stopCamera()
    stopScreenShare()
    stopVoiceRecognition()
    setChatMessages([])
    setUserInput("")
    setError(null)
    addMessage("system", "⏹️ AI Vision Chatを停止しました。")
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
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    style={{ transform: cameraState.facingMode === "user" ? "scaleX(-1)" : "none" }}
                  />
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

              {/* Camera Controls */}
              {isStarted && inputMode === "camera" && (
                <div className="flex justify-center gap-2">
                  <Button onClick={switchCamera} variant="outline" size="sm">
                    <Camera className="w-4 h-4 mr-2" />
                    カメラ切替
                  </Button>
                </div>
              )}

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
                      if (isStarted && !isLoading) {
                        handleAnalyze()
                      }
                    }
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleAnalyze()}
                    disabled={!isStarted || isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                    variant="outline"
                    disabled={!isStarted}
                  >
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
                      <SelectItem value="general_assistant">一般アシスタント</SelectItem>
                      <SelectItem value="technical_support">技術サポート</SelectItem>
                      <SelectItem value="coffee_indicator_analysis">コーヒーメーカー分析</SelectItem>
                      <SelectItem value="default_support">デフォルトサポート</SelectItem>
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
                        <SelectItem value="general">一般</SelectItem>
                        <SelectItem value="maintenance">メンテナンス</SelectItem>
                        <SelectItem value="troubleshooting">トラブルシューティング</SelectItem>
                        <SelectItem value="safety">安全</SelectItem>
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
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {ragDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
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
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
