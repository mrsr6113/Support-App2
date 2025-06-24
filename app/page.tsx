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
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  Send,
  Brain,
  Zap,
  Target,
  Search,
} from "lucide-react"

interface ChatMessage {
  id: string
  type: "user" | "ai" | "system"
  content: string
  imageData?: string
  timestamp: Date
  isVoice?: boolean
  metadata?: {
    extractedContext?: any
    relevantDocuments?: any[]
    processingTime?: number
    intelligentAnalysis?: boolean
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

// Simple speech recognition hook implementation
const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)

  const isSupported =
    typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)

  const startListening = () => {
    if (!isSupported) {
      setError("音声認識はこのブラウザではサポートされていません")
      return
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()

      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = "ja-JP"

      recognitionRef.current.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex
        const transcript = event.results[current][0].transcript
        setTranscript(transcript)
      }

      recognitionRef.current.onerror = (event: any) => {
        setError(`音声認識エラー: ${event.error}`)
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current.start()
    } catch (err) {
      setError("音声認識の開始に失敗しました")
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  const resetTranscript = () => {
    setTranscript("")
  }

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  }
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
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Media state
  const [inputMode, setInputMode] = useState<"camera" | "screen">("camera")
  const [isStarted, setIsStarted] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Analysis settings
  const [analysisFrequency, setAnalysisFrequency] = useState<number>(10)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)
  const [isAutoAnalysis, setIsAutoAnalysis] = useState(false)

  // Prompt selection state
  const [selectedSystemPrompt, setSelectedSystemPrompt] = useState<string>("default")
  const [selectedAnalysisPrompt, setSelectedAnalysisPrompt] = useState<string>("default")
  const [visualAnalysisPrompts, setVisualAnalysisPrompts] = useState<any[]>([])

  // Voice state - replace existing voice state with this
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechSupported,
    error: speechError,
  } = useSpeechRecognition()

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  // RAG state (for management only)
  const [ragDocuments, setRAGDocuments] = useState<RAGDocument[]>([])
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([])
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
    loadVisualAnalysisPrompts()
  }, [])

  // Add this useEffect after the existing useEffects
  useEffect(() => {
    if (transcript && transcript.trim()) {
      setUserInput(transcript.trim())
    }
  }, [transcript])

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

  const loadVisualAnalysisPrompts = async () => {
    try {
      const response = await fetch("/api/supabase/visual-prompts")
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setVisualAnalysisPrompts(result.prompts || [])
        }
      }
    } catch (error) {
      console.error("Failed to load visual analysis prompts:", error)
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
      addMessage(
        "system",
        "📷 カメラを開始しました。画像を撮影すると、AIが自動的に関連する知識ベースを検索して回答します。",
      )

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
      addMessage(
        "system",
        "🖥️ 画面共有を開始しました。画面をキャプチャすると、AIが自動的に関連する知識ベースを検索して回答します。",
      )

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
    setUserInput("")
    setError(null)
    addMessage("system", "🛑 キャプチャを停止しました。チャット履歴は保持されています。")
  }

  // Fixed Analysis functions
  const captureFrame = (): string | null => {
    try {
      if (!videoRef.current || !canvasRef.current) {
        console.error("Video or canvas ref not available")
        return null
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        console.error("Canvas context not available")
        return null
      }

      // Check if video is ready and has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error("Video not ready or has no dimensions")
        return null
      }

      // Check if video is playing
      if (video.paused || video.ended) {
        console.error("Video is paused or ended")
        return null
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Clear canvas and draw video frame
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to base64
      const dataURL = canvas.toDataURL("image/jpeg", 0.8)

      // Validate the captured image
      if (dataURL === "data:,") {
        console.error("Canvas is empty - no image captured")
        return null
      }

      console.log("Image captured successfully:", {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        dataURLLength: dataURL.length,
      })

      return dataURL
    } catch (error) {
      console.error("Error capturing frame:", error)
      return null
    }
  }

  const startPeriodicAnalysis = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      if (!isLoading) {
        handleIntelligentAnalyze(true)
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
  const saveChatSession = async (sessionId: string, newMessage: ChatMessage) => {
    try {
      const updatedMessages = [...chatMessages, newMessage]

      const response = await fetch("/api/supabase/chat-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: updatedMessages.map((msg) => ({
            role: msg.type === "user" ? "user" : msg.type === "ai" ? "model" : "system",
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            imageData: msg.imageData,
            metadata: msg.metadata,
          })),
        }),
      })

      if (!response.ok) {
        console.error("Failed to save chat session")
      }
    } catch (error) {
      console.error("Error saving chat session:", error)
    }
  }

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

    // Save to chat session if it's a user or AI message
    if (type === "user" || type === "ai") {
      const sessionId = `session_${Date.now()}`
      saveChatSession(sessionId, message)
    }

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

  // Enhanced Intelligent Analysis function
  const handleIntelligentAnalyze = async (isAutomatic = false) => {
    console.log("Starting intelligent analysis...")

    const imageData = captureFrame()
    if (!imageData) {
      const errorMsg =
        "画像をキャプチャできませんでした。カメラまたは画面共有が正常に動作していることを確認してください。"
      if (!isAutomatic) {
        setError(errorMsg)
        addMessage("system", `❌ ${errorMsg}`)
      }
      console.error("Failed to capture image")
      return
    }

    setIsLoading(true)
    setError(null)

    const prompt = userInput.trim() || "この画像を分析して、問題があれば解決方法を教えてください。"

    if (!isAutomatic) {
      addMessage("user", prompt, imageData, {
        intelligentAnalysis: true,
      })
      setUserInput("")
    }

    try {
      const base64Image = imageData.split(",")[1]

      console.log("Sending request to intelligent RAG API...")

      // Get selected system prompt
      let systemPrompt = ""
      if (selectedSystemPrompt && selectedSystemPrompt !== "default") {
        const selectedPrompt = systemPrompts.find((p) => p.id === selectedSystemPrompt)
        systemPrompt = selectedPrompt?.prompt || ""
      }

      // Get selected analysis prompt
      let analysisPromptText = prompt
      if (selectedAnalysisPrompt && selectedAnalysisPrompt !== "default") {
        const selectedPrompt = visualAnalysisPrompts.find((p) => p.id === selectedAnalysisPrompt)
        analysisPromptText = selectedPrompt?.prompt || prompt
      }

      // Update the API call to include the selected prompts
      const response = await fetch("/api/intelligent-rag/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType: "image/jpeg",
          userPrompt: analysisPromptText,
          systemPrompt: systemPrompt,
          chatHistory: chatMessages
            .filter((msg) => msg.type === "user" || msg.type === "ai")
            .slice(-10)
            .map((msg) => ({
              role: msg.type === "user" ? "user" : "model",
              parts: [{ text: msg.content }],
            })),
          sessionId: `session_${Date.now()}`,
        }),
      })

      const result = await response.json()
      console.log("Received response from intelligent RAG API:", result)

      if (result.success) {
        // Add AI response with intelligent analysis metadata
        addMessage("ai", result.response, undefined, {
          extractedContext: result.extractedContext,
          relevantDocuments: result.relevantDocuments,
          processingTime: result.processingTimeMs,
          intelligentAnalysis: true,
        })

        // Add system message showing what the AI detected and which documents it used
        if (result.relevantDocuments && result.relevantDocuments.length > 0) {
          const contextSummary = `🧠 **インテリジェント分析結果**

**検出された内容:**
- デバイス: ${result.extractedContext?.deviceType || "不明"}
- カテゴリ: ${result.extractedContext?.primaryCategory || "一般"}
- 問題: ${result.extractedContext?.detectedIssues?.join(", ") || "なし"}
- 緊急度: ${result.extractedContext?.urgencyLevel || "中"}

**自動選択された関連文書 (${result.relevantDocuments.length}件):**
${result.relevantDocuments
  .map((doc: any, index: number) => `${index + 1}. ${doc.title} (関連度: ${(doc.relevance_score * 100).toFixed(1)}%)`)
  .join("\n")}

⏱️ **処理時間**: ${result.processingTimeMs}ms`

          addMessage("system", contextSummary)
        } else {
          addMessage(
            "system",
            `🧠 **インテリジェント分析完了**\n\n検出されたカテゴリ: ${result.extractedContext?.primaryCategory || "一般"}\n関連文書: 見つかりませんでした\n\n⏱️ 処理時間: ${result.processingTimeMs}ms`,
          )
        }
      } else {
        if (!isAutomatic) {
          setError(result.error || "分析に失敗しました。")
          addMessage("system", `❌ 分析エラー: ${result.error || "不明なエラー"}`)
        }
      }
    } catch (error) {
      if (!isAutomatic) {
        console.error("Intelligent analysis error:", error)
        const errorMsg = "インテリジェント分析中にエラーが発生しました。"
        setError(errorMsg)
        addMessage("system", `❌ ${errorMsg}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Replace the handleSendMessage function with this enhanced version
  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return

    const messageText = userInput.trim()
    setUserInput("")
    resetTranscript()

    if (isStarted) {
      // Image-based analysis with intelligent RAG
      handleIntelligentAnalyze()
    } else {
      // Text-only chat
      addMessage("user", messageText, undefined, { textOnly: true })

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/text-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: messageText,
            chatHistory: chatMessages
              .filter((msg) => msg.type === "user" || msg.type === "ai")
              .slice(-10)
              .map((msg) => ({
                role: msg.type === "user" ? "user" : "model",
                content: msg.content,
              })),
          }),
        })

        const result = await response.json()

        if (result.success) {
          addMessage("ai", result.response, undefined, {
            textOnly: true,
            processingTime: result.processingTimeMs,
          })
        } else {
          setError(result.error || "チャット処理に失敗しました。")
        }
      } catch (error) {
        console.error("Text chat error:", error)
        setError("チャット中にエラーが発生しました。")
      } finally {
        setIsLoading(false)
      }
    }
  }

  // RAG functions (for management only)
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
        addMessage("system", "📷 画像を処理中...")
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

      addMessage("system", `💾 RAG文書「${entry.title}」を${editingRAGEntry ? "更新" : "保存"}中...`)

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
        addMessage(
          "system",
          `✅ RAG文書「${entry.title}」を${editingRAGEntry ? "更新" : "追加"}しました。この文書は今後の画像分析で自動的に検索対象となります。`,
        )

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

        // Reload documents to reflect changes
        await loadRAGDocuments()

        addMessage("system", "🔄 知識ベースを更新しました。")
      } else {
        setError(result.error || "RAG文書の保存に失敗しました。")
        addMessage("system", `❌ エラー: ${result.error || "RAG文書の保存に失敗しました。"}`)
      }
    } catch (error) {
      console.error("RAG save error:", error)
      const errorMsg = "RAG文書の保存中にエラーが発生しました。"
      setError(errorMsg)
      addMessage("system", `❌ ${errorMsg}`)
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

  // Fixed RAG editing function
  const startEditRAGEntry = (doc: RAGDocument) => {
    console.log("Starting to edit RAG entry:", doc)

    // Ensure tags is always an array
    const tagsArray = Array.isArray(doc.tags) ? doc.tags : []

    setEditingRAGEntry({
      ...doc,
      tags: tagsArray, // Keep as array for internal use
      image: null,
    } as any)
    setIsEditDialogOpen(true)
  }

  // Main control functions
  const handleStart = async () => {
    setIsStarted(true)
    addMessage(
      "system",
      "🚀 **インテリジェントAI Vision Chat**を開始しました。\n\n✨ **新機能**: 画像を分析すると、AIが自動的に最適な知識ベース文書を検索して回答します。手動での文書選択は不要です！",
    )

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
      return "w-full h-[60vh] bg-black rounded-lg overflow-hidden mb-4"
    } else {
      // Desktop size
      return "w-full h-64 bg-black rounded-lg overflow-hidden"
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-2 sm:p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
            Intelligent AI Vision Chat
            <Badge variant="default" className="ml-2 text-xs">
              <Zap className="w-3 h-3 mr-1" />
              Auto RAG
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-grow flex flex-col p-0">
          <Tabs defaultValue="chat" className="flex-grow flex flex-col">
            {/* --- 修正箇所：TabsList --- */}
            <TabsList className="grid w-full grid-cols-3 text-xs sm:text-sm h-auto p-1">
              <TabsTrigger value="chat" className="py-1.5 sm:py-2">
                インテリジェントチャット
              </TabsTrigger>
              <TabsTrigger value="settings" className="py-1.5 sm:py-2">
                設定
              </TabsTrigger>
              <TabsTrigger value="rag" className="py-1.5 sm:py-2">
                知識ベース管理
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-grow flex flex-col space-y-4 p-2 sm:p-4">
              {/* --- 修正箇所：コントロールセクション --- */}
              <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
                <RadioGroup
                  value={inputMode}
                  onValueChange={(value: "camera" | "screen") => setInputMode(value)}
                  className="flex items-center space-x-4"
                  disabled={isStarted}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="camera" id="camera" />
                    <Label htmlFor="camera" className="flex items-center gap-2 cursor-pointer">
                      <Camera className="w-4 h-4" />
                      カメラ
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="screen" id="screen" />
                    <Label htmlFor="screen" className="flex items-center gap-2 cursor-pointer">
                      <Monitor className="w-4 h-4" />
                      画面共有
                    </Label>
                  </div>
                </RadioGroup>

                <div className="flex gap-2">
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

              {isStarted && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Target className="w-4 h-4" />
                    <span className="font-medium">インテリジェント分析モード</span>
                  </div>
                  <p className="text-blue-700 mt-1">
                    AIが自動的に関連文書（{ragDocuments.length}
                    件）を検索して回答します。
                  </p>
                </div>
              )}

              <div className={getVideoAreaClasses()}>
                {isStarted ? (
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                ) : (
                  <div className="text-gray-500 text-center p-4">
                    <div className="mb-2">
                      {inputMode === "camera" ? (
                        <Camera className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2" />
                      ) : (
                        <Monitor className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2" />
                      )}
                    </div>
                    <p className="font-medium">
                      開始ボタンを押して{inputMode === "camera" ? "カメラ" : "画面共有"}を開始
                    </p>
                    <p className="text-sm mt-1">AIが自動的に関連文書を検索します</p>
                  </div>
                )}
              </div>

              {(error || speechError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error || speechError}</AlertDescription>
                </Alert>
              )}

              <ScrollArea className="flex-grow border rounded-lg p-2 sm:p-4 min-h-[150px]">
                <div className="space-y-4">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 ${
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
                          {message.metadata?.intelligentAnalysis && (
                            <Badge variant="outline" className="text-xs">
                              <Brain className="w-3 h-3 mr-1" />
                              AI分析
                            </Badge>
                          )}
                        </div>
                        {message.imageData && (
                          <img
                            src={message.imageData || "/placeholder.svg"}
                            alt="Captured frame"
                            className="w-full max-w-xs rounded mb-2"
                          />
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.metadata?.processingTime && (
                          <div className="text-xs opacity-70 mt-1">処理時間: {message.metadata.processingTime}ms</div>
                        )}
                        {message.metadata?.relevantDocuments && message.metadata.relevantDocuments.length > 0 && (
                          <div className="text-xs opacity-70 mt-1">
                            自動選択文書: {message.metadata.relevantDocuments.length}件
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <div className="flex-grow relative">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={isListening ? "音声入力中..." : "メッセージを入力（任意）..."}
                    className={`resize-none ${isListening ? "border-red-300 bg-red-50" : ""}`}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                  {isListening && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 text-red-600 text-xs">
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                        録音中
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleSendMessage}
                    disabled={!userInput.trim() || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 h-full"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={isListening ? stopListening : startListening}
                    variant="outline"
                    disabled={!isSpeechSupported}
                    className={isListening ? "bg-red-100 border-red-300" : ""}
                    title={
                      !isSpeechSupported
                        ? "音声認識はサポートされていません"
                        : isListening
                          ? "音声入力を停止"
                          : "音声入力を開始"
                    }
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="system-prompt">システムプロンプト</Label>
                  <Select value={selectedSystemPrompt} onValueChange={setSelectedSystemPrompt}>
                    <SelectTrigger>
                      <SelectValue placeholder="システムプロンプトを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">デフォルト</SelectItem>
                      {systemPrompts.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {prompt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="analysis-prompt">分析プロンプト</Label>
                  <Select value={selectedAnalysisPrompt} onValueChange={setSelectedAnalysisPrompt}>
                    <SelectTrigger>
                      <SelectValue placeholder="分析プロンプトを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">デフォルト</SelectItem>
                      {visualAnalysisPrompts.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {prompt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                  <Label>知識ベース統計</Label>
                  <div className="text-sm text-gray-600 mt-1">
                    <p>登録文書数: {ragDocuments.length}件</p>
                    <p>カテゴリ数: {[...new Set(ragDocuments.map((doc) => doc.category))].length}種類</p>
                  </div>
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

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  インテリジェント機能
                </h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>✅ 自動文書検索: 画像内容に基づいて関連文書を自動選択</li>
                  <li>✅ コンテキスト抽出: デバイス種類、問題、緊急度を自動判定</li>
                  <li>✅ 複合検索: ベクトル類似度 + キーワード + カテゴリ検索</li>
                  <li>✅ 関連度スコア: 各文書の関連度を数値化して最適化</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="rag" className="space-y-4 p-4">
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  知識ベース文書管理
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
                        <SelectValue placeholder="カテゴリを選択" />
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
                  知識ベース文書を保存
                </Button>
              </div>

              {/* Existing RAG Documents */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  登録済み知識ベース文書 ({ragDocuments.length}件)
                </h4>
                <p className="text-sm text-gray-600 mb-3">これらの文書は画像分析時に自動的に検索対象となります。</p>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {ragDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{doc.title}</span>
                            <Badge variant="outline">{doc.category}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{doc.content.substring(0, 100)}...</p>
                          {doc.tags && doc.tags.length > 0 && (
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

      {/* Fixed Edit RAG Document Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              知識ベース文書を編集
            </DialogTitle>
          </DialogHeader>
          {editingRAGEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-rag-title">文書タイトル</Label>
                  <Input
                    id="edit-rag-title"
                    value={editingRAGEntry.title}
                    onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, title: e.target.value }) as any)}
                    placeholder="例: 警告アイコン対応手順"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-rag-category">カテゴリ</Label>
                  <Select
                    value={editingRAGEntry.category}
                    onValueChange={(value) => setEditingRAGEntry((prev) => ({ ...prev!, category: value }) as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="カテゴリを選択" />
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
                  <Label htmlFor="edit-rag-icon-name">アイコン名</Label>
                  <Input
                    id="edit-rag-icon-name"
                    value={editingRAGEntry.icon_name || ""}
                    onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, icon_name: e.target.value }) as any)}
                    placeholder="例: 警告ランプ"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-rag-tags">タグ (カンマ区切り)</Label>
                  <Input
                    id="edit-rag-tags"
                    value={Array.isArray(editingRAGEntry.tags) ? editingRAGEntry.tags.join(", ") : ""}
                    onChange={(e) =>
                      setEditingRAGEntry(
                        (prev) =>
                          ({
                            ...prev!,
                            tags: e.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          }) as any,
                      )
                    }
                    placeholder="例: 警告, ランプ, 赤色"
                  />
                </div>
              </div>

              <div className="mb-4">
                <Label htmlFor="edit-rag-icon-description">アイコン説明</Label>
                <Textarea
                  id="edit-rag-icon-description"
                  value={editingRAGEntry.icon_description || ""}
                  onChange={(e) =>
                    setEditingRAGEntry((prev) => ({ ...prev!, icon_description: e.target.value }) as any)
                  }
                  placeholder="アイコンの詳細な説明を入力..."
                  rows={2}
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="edit-rag-content">文書内容</Label>
                <Textarea
                  id="edit-rag-content"
                  value={editingRAGEntry.content}
                  onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, content: e.target.value }) as any)}
                  placeholder="トラブルシューティング手順や解決方法を詳しく記述..."
                  rows={4}
                />
              </div>

              <div className="mb-4">
                <Label htmlFor="edit-rag-image">参考画像</Label>
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
                知識ベース文書を保存
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
