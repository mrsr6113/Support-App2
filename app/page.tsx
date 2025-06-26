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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  VolumeX,
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

// Enhanced universal speech recognition hook
const useUniversalSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isContinuous, setIsContinuous] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const recognitionRef = useRef<any>(null)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check browser support
  const isSupported =
    typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)

  // Initialize speech recognition
  const initializeSpeechRecognition = () => {
    if (!isSupported) {
      setError("音声認識はこのブラウザではサポートされていません")
      return false
    }

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()

      // Universal settings for all devices
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = "ja-JP"
      recognitionRef.current.maxAlternatives = 1

      // Event handlers
      recognitionRef.current.onstart = () => {
        console.log("Speech recognition started")
        setIsListening(true)
        setError(null)
      }

      recognitionRef.current.onresult = (event: any) => {
        console.log("Speech recognition result:", event)
        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        const currentTranscript = finalTranscript || interimTranscript
        setTranscript(currentTranscript)
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)

        let errorMessage = "音声認識エラーが発生しました"
        switch (event.error) {
          case "not-allowed":
            errorMessage = "マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。"
            break
          case "no-speech":
            errorMessage = "音声が検出されませんでした。もう一度お試しください。"
            break
          case "audio-capture":
            errorMessage = "マイクにアクセスできません。デバイスを確認してください。"
            break
          case "network":
            errorMessage = "ネットワークエラーが発生しました。"
            break
          default:
            errorMessage = `音声認識エラー: ${event.error}`
        }

        setError(errorMessage)
        setIsListening(false)

        // Auto-retry for certain errors in continuous mode
        if (isContinuous && !["not-allowed", "audio-capture"].includes(event.error)) {
          restartTimeoutRef.current = setTimeout(() => {
            startListening(true)
          }, 2000)
        }
      }

      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended")
        setIsListening(false)

        // Auto-restart in continuous mode
        if (isContinuous) {
          restartTimeoutRef.current = setTimeout(() => {
            startListening(true)
          }, 1000)
        }
      }

      setIsInitialized(true)
      return true
    } catch (err) {
      console.error("Speech recognition initialization error:", err)
      setError("音声認識の初期化に失敗しました")
      return false
    }
  }

  // Request microphone permission
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop()) // Stop immediately, we just needed permission
      return true
    } catch (error) {
      console.error("Microphone permission error:", error)
      setError("マイクへのアクセス許可が必要です。ブラウザの設定を確認してください。")
      return false
    }
  }

  const startListening = async (continuous = false) => {
    console.log("Starting speech recognition, continuous:", continuous)

    if (!isSupported) {
      setError("音声認識はこのブラウザではサポートされていません")
      return
    }

    // Request microphone permission first
    const hasPermission = await requestMicrophonePermission()
    if (!hasPermission) {
      return
    }

    // Initialize if not already done
    if (!isInitialized) {
      const initialized = initializeSpeechRecognition()
      if (!initialized) {
        return
      }
    }

    // Stop any existing recognition
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }

    // Clear any restart timeouts
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    setIsContinuous(continuous)
    setError(null)

    try {
      // Update settings for this session
      if (recognitionRef.current) {
        recognitionRef.current.continuous = continuous
        recognitionRef.current.start()
      }
    } catch (err) {
      console.error("Speech recognition start error:", err)
      setError("音声認識の開始に失敗しました")
      setIsListening(false)
    }
  }

  const stopListening = () => {
    console.log("Stopping speech recognition")

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.error("Error stopping speech recognition:", err)
      }
    }

    setIsListening(false)
    setIsContinuous(false)
  }

  const resetTranscript = () => {
    setTranscript("")
  }

  // Initialize on mount
  useEffect(() => {
    if (isSupported && !isInitialized) {
      initializeSpeechRecognition()
    }
  }, [isSupported, isInitialized])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err) {
          console.error("Cleanup error:", err)
        }
      }
    }
  }, [])

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
    isContinuous,
    isInitialized,
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

  // Enhanced voice state
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: isSpeechSupported,
    error: speechError,
    isContinuous,
    isInitialized,
  } = useUniversalSpeechRecognition()

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  // RAG state
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

  // UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ragImageInputRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  // Enhanced voice command processing
  useEffect(() => {
    if (transcript && transcript.trim()) {
      const lowerTranscript = transcript.toLowerCase()

      // Voice command: Send message
      if (lowerTranscript.includes("送信") || lowerTranscript.includes("そうしん")) {
        const messageToSend = transcript.replace(/送信|そうしん/gi, "").trim()
        if (messageToSend) {
          setUserInput(messageToSend)
          setTimeout(() => handleSendMessage(), 100)
        }
        resetTranscript()
        return
      }

      // Voice command: Start camera
      if (
        lowerTranscript.includes("カメラ起動") ||
        lowerTranscript.includes("かめらきどう") ||
        lowerTranscript.includes("カメラ開始") ||
        lowerTranscript.includes("かめらかいし")
      ) {
        if (!isStarted) {
          handleStart()
        }
        resetTranscript()
        return
      }

      // Voice command: Stop camera
      if (
        lowerTranscript.includes("カメラ停止") ||
        lowerTranscript.includes("かめらていし") ||
        lowerTranscript.includes("停止") ||
        lowerTranscript.includes("ていし")
      ) {
        if (isStarted) {
          handleStop()
        }
        resetTranscript()
        return
      }

      // Regular input
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

    // Stop continuous listening when camera stops
    if (isContinuous) {
      stopListening()
    }

    setUserInput("")
    setError(null)
  }

  // Analysis functions
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

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error("Video not ready or has no dimensions")
        return null
      }

      if (video.paused || video.ended) {
        console.error("Video is paused or ended")
        return null
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const dataURL = canvas.toDataURL("image/jpeg", 0.8)

      if (dataURL === "data:,") {
        console.error("Canvas is empty - no image captured")
        return null
      }

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

  // Enhanced universal TTS function
  const speakText = async (text: string) => {
    if (!isVoiceEnabled || isSpeaking) return

    try {
      setIsSpeaking(true)
      console.log("Starting TTS for text:", text.substring(0, 50) + "...")

      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Language-Code": "ja-JP",
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status} ${response.statusText}`)
      }

      const audioBlob = await response.blob()

      if (audioBlob.size === 0) {
        throw new Error("Empty audio response")
      }

      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      // Enhanced audio event handling
      audio.onloadeddata = () => {
        console.log("Audio loaded successfully")
      }

      audio.oncanplaythrough = () => {
        console.log("Audio can play through")
        audio.play().catch((error) => {
          console.error("Audio play error:", error)
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        })
      }

      audio.onended = () => {
        console.log("TTS playback completed")
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }

      audio.onerror = (error) => {
        console.error("Audio playback error:", error)
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
        audioRef.current = null
      }

      // Set volume and load
      audio.volume = 0.8
      audio.load()
    } catch (error) {
      console.error("Text-to-speech error:", error)
      setIsSpeaking(false)

      // Show user-friendly error
      if (error instanceof Error) {
        setError(`音声読み上げエラー: ${error.message}`)
      } else {
        setError("音声読み上げ中にエラーが発生しました")
      }
    }
  }

  // Enhanced Intelligent Analysis function
  const handleIntelligentAnalyze = async (isAutomatic = false) => {
    const imageData = captureFrame()
    if (!imageData) {
      const errorMsg = "画像をキャプチャできませんでした。"
      if (!isAutomatic) {
        setError(errorMsg)
      }
      return
    }

    setIsLoading(true)
    setError(null)

    const prompt = userInput.trim() || "この画像を分析して、問題があれば解決方法を教えてください。"

    if (!isAutomatic) {
      addMessage("user", prompt, imageData, { intelligentAnalysis: true })
      setUserInput("")
      resetTranscript()
    }

    try {
      const base64Image = imageData.split(",")[1]

      let systemPrompt = ""
      if (selectedSystemPrompt && selectedSystemPrompt !== "default") {
        const selectedPrompt = systemPrompts.find((p) => p.id === selectedSystemPrompt)
        systemPrompt = selectedPrompt?.prompt || ""
      }

      let analysisPromptText = prompt
      if (selectedAnalysisPrompt && selectedAnalysisPrompt !== "default") {
        const selectedPrompt = visualAnalysisPrompts.find((p) => p.id === selectedAnalysisPrompt)
        analysisPromptText = selectedPrompt?.prompt || prompt
      }

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

      if (result.success) {
        addMessage("ai", result.response, undefined, {
          extractedContext: result.extractedContext,
          relevantDocuments: result.relevantDocuments,
          processingTime: result.processingTimeMs,
          intelligentAnalysis: true,
        })
      } else {
        if (!isAutomatic) {
          setError(result.error || "分析に失敗しました。")
        }
      }
    } catch (error) {
      if (!isAutomatic) {
        console.error("Intelligent analysis error:", error)
        const errorMsg = "インテリジェント分析中にエラーが発生しました。"
        setError(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return

    const messageText = userInput.trim()
    setUserInput("")
    resetTranscript()

    if (isStarted) {
      handleIntelligentAnalyze()
    } else {
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

  // Enhanced voice control functions
  const handleVoiceToggle = async () => {
    if (isListening) {
      stopListening()
    } else {
      // Start single-shot voice recognition
      await startListening(false)
    }
  }

  const handleContinuousVoiceToggle = async () => {
    if (isContinuous) {
      stopListening()
    } else {
      // Start continuous voice recognition
      await startListening(true)
    }
  }

  // RAG functions
  const handleRAGImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      if (!validTypes.includes(file.type)) {
        setError("サポートされていない画像形式です。")
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
        response = await fetch("/api/supabase/rag-documents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRAGEntry.id, ...requestData }),
        })
      } else {
        response = await fetch("/api/supabase/rag-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        })
      }

      const result = await response.json()

      if (result.success) {
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
        await loadRAGDocuments()
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
    const tagsArray = Array.isArray(doc.tags) ? doc.tags : []

    setEditingRAGEntry({
      ...doc,
      tags: tagsArray,
      image: null,
    } as any)
    setIsEditDialogOpen(true)
  }

  // Main control functions
  const handleStart = async () => {
    setIsStarted(true)

    if (inputMode === "camera") {
      await startCamera()
    } else {
      await startScreenShare()
    }
  }

  const handleStop = () => {
    stopCapture()
    // Don't clear chat messages - keep them persistent
    setUserInput("")
    setError(null)
  }

  // Calculate video area size
  const getVideoAreaClasses = () => {
    if (!isStarted) {
      return "w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center"
    }

    if (isMobile) {
      // Reduced height for mobile (2/3 of original)
      return "w-full h-[40vh] bg-black rounded-lg overflow-hidden"
    } else {
      return "w-full h-64 bg-black rounded-lg overflow-hidden"
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-2 sm:p-4">
      <Card className="flex-grow flex flex-col">
        {/* Header with Settings Button */}
        <CardHeader className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center justify-between text-base sm:text-lg">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
              Universal AI Vision Chat
              <Badge variant="default" className="ml-2 text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Voice + TTS
              </Badge>
            </div>

            {/* Settings Button - Fixed */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">設定</span>
            </Button>
          </CardTitle>
        </CardHeader>

        {/* Main Content - Fixed Layout */}
        <CardContent className="flex-grow flex flex-col p-0 overflow-hidden">
          <div className="flex-grow flex flex-col p-2 sm:p-4 space-y-4 overflow-hidden">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 flex-shrink-0">
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
                  <Button onClick={handleStart} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4 mr-2" />
                    開始
                  </Button>
                ) : (
                  <Button onClick={handleStop} size="sm" variant="destructive">
                    <Square className="w-4 h-4 mr-2" />
                    停止
                  </Button>
                )}
              </div>
            </div>

            {/* Video Area - Fixed */}
            <div className={`${getVideoAreaClasses()} flex-shrink-0`}>
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

            {/* Error Display */}
            {(error || speechError) && (
              <Alert variant="destructive" className="flex-shrink-0">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error || speechError}</AlertDescription>
              </Alert>
            )}

            {/* Chat Messages - Scrollable */}
            <ScrollArea className="flex-grow border rounded-lg p-2 sm:p-4 min-h-0">
              <div className="space-y-4">
                {chatMessages
                  .filter((message) => message.type !== "system") // Hide system messages
                  .map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 ${
                          message.type === "user" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {message.type === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
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
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>

            {/* Input Area - Fixed with Clear Button Separation */}
            <div className="flex gap-2 flex-shrink-0">
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
                      音声入力中
                    </div>
                  </div>
                )}
              </div>

              {/* Button Group - Clearly Separated Functions */}
              <div className="flex flex-col gap-2">
                {/* Send Message Button */}
                <Button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                  title="メッセージを送信"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>

                {/* Voice Input Button */}
                <Button
                  onClick={handleVoiceToggle}
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

                {/* Text-to-Speech Button */}
                <Button
                  onClick={() => {
                    if (isSpeaking) {
                      // Stop current speech
                      if (audioRef.current) {
                        audioRef.current.pause()
                        audioRef.current = null
                      }
                      setIsSpeaking(false)
                    } else {
                      // Read the current input or last AI message
                      const textToRead =
                        userInput.trim() ||
                        chatMessages.filter((msg) => msg.type === "ai").slice(-1)[0]?.content ||
                        "読み上げるテキストがありません"
                      speakText(textToRead)
                    }
                  }}
                  variant="outline"
                  disabled={!isVoiceEnabled}
                  className={isSpeaking ? "bg-blue-100 border-blue-300" : ""}
                  title={
                    !isVoiceEnabled ? "音声読み上げが無効です" : isSpeaking ? "読み上げを停止" : "テキストを読み上げ"
                  }
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit RAG Document Dialog */}
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
              <div>
                <Label>文書タイトル</Label>
                <Input
                  value={editingRAGEntry.title}
                  onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, title: e.target.value }) as any)}
                />
              </div>

              <div>
                <Label>文書内容</Label>
                <Textarea
                  value={editingRAGEntry.content}
                  onChange={(e) => setEditingRAGEntry((prev) => ({ ...prev!, content: e.target.value }) as any)}
                  rows={4}
                />
              </div>

              <Button onClick={saveRAGEntry} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                文書を保存
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Settings Panel - Fixed */}
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>設定と知識ベース管理</SheetTitle>
            <SheetDescription>システム設定とRAG文書の管理を行います</SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="settings" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings">設定</TabsTrigger>
              <TabsTrigger value="rag">知識ベース</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 gap-4">
                {/* Voice and TTS Settings */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    音声機能設定
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="voice-enabled">音声読み上げ</Label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="voice-enabled"
                          checked={isVoiceEnabled}
                          onChange={(e) => setIsVoiceEnabled(e.target.checked)}
                          className="rounded"
                        />
                        {isSpeaking ? (
                          <Volume2 className="w-4 h-4 text-blue-500" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-blue-700">
                      <p>• 音声入力: {isSpeechSupported ? "利用可能" : "利用不可"}</p>
                      <p>• 認識状態: {isListening ? "認識中" : "待機中"}</p>
                      <p>• 読み上げ: {isSpeaking ? "再生中" : "停止中"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>システムプロンプト</Label>
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
                  <Label>分析プロンプト</Label>
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

                <div>
                  <Label>分析頻度 (秒)</Label>
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

                <div className="space-y-3">
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
                </div>

                <div>
                  <Label>知識ベース統計</Label>
                  <div className="text-sm text-gray-600 mt-1">
                    <p>登録文書数: {ragDocuments.length}件</p>
                    <p>カテゴリ数: {[...new Set(ragDocuments.map((doc) => doc.category))].length}種類</p>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    音声コマンド
                  </h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• 「送信」: メッセージを送信</li>
                    <li>• 「カメラ起動」: カメラを開始</li>
                    <li>• 「停止」: カメラを停止</li>
                    <li>• PC/モバイル両対応</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rag" className="space-y-4 mt-4">
              {/* RAG Document Management */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  新しい文書を追加
                </h3>

                <div className="space-y-4">
                  <div>
                    <Label>文書タイトル</Label>
                    <Input
                      value={newRAGEntry.title}
                      onChange={(e) => setNewRAGEntry((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="例: 警告アイコン対応手順"
                    />
                  </div>

                  <div>
                    <Label>カテゴリ</Label>
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

                  <div>
                    <Label>文書内容</Label>
                    <Textarea
                      value={newRAGEntry.content}
                      onChange={(e) => setNewRAGEntry((prev) => ({ ...prev, content: e.target.value }))}
                      placeholder="トラブルシューティング手順や解決方法を詳しく記述..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>参考画像</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => ragImageInputRef.current?.click()}
                        variant="outline"
                        size="sm"
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
                    文書を保存
                  </Button>
                </div>
              </div>

              {/* Existing RAG Documents */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  登録済み文書 ({ragDocuments.length}件)
                </h4>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {ragDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-sm">{doc.title}</span>
                            <Badge variant="outline" className="text-xs">
                              {doc.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{doc.content.substring(0, 80)}...</p>
                        </div>
                        <div className="flex gap-1">
                          <Button onClick={() => startEditRAGEntry(doc)} variant="outline" size="sm">
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button onClick={() => deleteRAGEntry(doc.id)} variant="outline" size="sm">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  )
}
