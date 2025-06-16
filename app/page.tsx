"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  MicOff,
  Play,
  Square,
  Camera,
  Monitor,
  AlertCircle,
  CheckCircle,
  Volume2,
  VolumeX,
  Eye,
  Settings,
  FileText,
  Search,
  Type,
  ImageIcon,
  FlipHorizontal,
  MessageSquare,
  Send,
  Upload,
  Save,
  RotateCcw,
  Database,
  Brain,
  Cloud,
  Loader2,
  Trash2,
  Plus,
} from "lucide-react"
import { useSupabaseRAGDocuments, useSupabaseSystemPrompts, useSupabaseVisualPrompts } from "@/hooks/useSupabaseData"

interface ChatMessage {
  id: string
  type: "user" | "ai" | "system" | "voice"
  content: string
  timestamp: Date
  isPeriodicAnalysis?: boolean
  isVoiceInput?: boolean
  hasImage?: boolean
  promptType?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: (event: any) => void
  onerror: (event: any) => void
  onend: () => void
  onstart: () => void
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition
    SpeechRecognition: new () => SpeechRecognition
  }
}

// Default fallback prompts (used if Supabase is unavailable)
const FALLBACK_VISUAL_ANALYSIS_PROMPTS = {
  detailed_detection: {
    name: "物体詳細検知",
    icon: <Eye className="w-4 h-4" />,
    prompt:
      "映った物体名を詳細に確認し、商品名や型番が特定出来たらWebで検索して詳しい特徴などを調べた結果を簡潔に回答してください。",
    description: "詳細な物体分析と仕様情報の提供",
  },
  simple_detection: {
    name: "簡易物体検知",
    icon: <Search className="w-4 h-4" />,
    prompt: "映った物体名を詳細に確認し、商品名などを簡潔に回答してください。",
    description: "基本的な物体の識別と商品名の特定",
  },
  text_recognition: {
    name: "文字認識",
    icon: <Type className="w-4 h-4" />,
    prompt: "映像に映った内容を正確に文字起こしを行ってください。",
    description: "画像内のテキストの読み取りと転写",
  },
  scene_analysis: {
    name: "シーン判別",
    icon: <ImageIcon className="w-4 h-4" />,
    prompt: "映像に映った内容がどんな状態であるかを詳細に回答してください。",
    description: "全体的な状況と環境の分析",
  },
  custom: {
    name: "カスタム",
    icon: <FileText className="w-4 h-4" />,
    prompt: "",
    description: "独自のプロンプトを設定",
  },
}

// Default System Prompt (Customer Support Professional)
const DEFAULT_SYSTEM_PROMPT = `あなたは顧客サポートのプロフェッショナルです。現在、ユーザーから音声またはチャットで問い合わせが寄せられています。
あなたの役割は、丁寧で信頼感のある対応を行い、ユーザーの問題を的確に解決することです。以下の対応方針に従ってください：

【対応方針】
常に丁寧・安心感のある言葉遣いで対応してください。
ユーザーが言葉で説明しづらそうな場合や、視覚的なサポートが有効な場面では、次のように提案してください：
「もしよろしければ、カメラでその対象物を映していただくか、画面を共有していただければ、状況を正確に把握できます。」
ユーザーがカメラや画面共有を希望した場合は、次のように案内してください：
「画面右下の📷アイコンをタップするとカメラが起動します。画面共有は🖥マークから開始できます。不明な点があればサポートいたします。」
映像が共有された場合は、リアルタイムで画像を解析し、問題を特定・解決してください。
映像だけで判断が難しい場合は、追加で必要な情報や映像の共有を丁寧にお願いしてください。
「AIにはできません」「画像は扱えません」などの表現は使わず、常にサポートできる姿勢を保ってください。

❌ 回答禁止例：
「画像は扱えません」
「画面共有ができません」
「私はテキストベースのAIです」

例：正しい対応例
ユーザー： これ、ちょっと見せたいんですけど…
あなた（AI）： もちろんです。カメラで対象を映していただくか、画面を共有していただければ、より正確にご案内できますよ。方法がわからなければ、操作方法もご案内いたします。`

export default function AIVisionChat() {
  const [captureMode, setCaptureMode] = useState<"camera" | "screen">("camera")
  const [visualAnalysisType, setVisualAnalysisType] = useState<string>("detailed_detection")
  const [customPrompt, setCustomPrompt] = useState("この画像に何が写っていますか？")
  const [chatMessage, setChatMessage] = useState("")
  const [frequency, setFrequency] = useState("0")
  const [isCapturing, setIsCapturing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)
  const [voiceLanguage, setVoiceLanguage] = useState("ja-JP")
  const [interfaceLanguage, setInterfaceLanguage] = useState("ja")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [voiceConfidence, setVoiceConfidence] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [tempSystemPrompt, setTempSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
  const [selectedSystemPromptId, setSelectedSystemPromptId] = useState<string>("")
  const [chatSessionId, setChatSessionId] = useState<string>("")
  const [newDocTitle, setNewDocTitle] = useState("")
  const [newDocContent, setNewDocContent] = useState("")
  const [newDocCategory, setNewDocCategory] = useState("FAQ")
  const [newDocTags, setNewDocTags] = useState("")
  const [capabilities, setCapabilities] = useState({
    camera: false,
    screenShare: false,
    speechRecognition: false,
    mobileScreenShare: false,
    multipleCameras: false,
  })

  // Supabase hooks
  const {
    documents: supabaseRAGDocuments,
    loading: ragLoading,
    error: ragError,
    addDocument: addRAGDocument,
    deleteDocument: deleteRAGDocument,
  } = useSupabaseRAGDocuments()

  const {
    prompts: supabaseSystemPrompts,
    loading: systemPromptsLoading,
    error: systemPromptsError,
    addPrompt: addSystemPrompt,
  } = useSupabaseSystemPrompts()

  const {
    prompts: supabaseVisualPrompts,
    loading: visualPromptsLoading,
    error: visualPromptsError,
  } = useSupabaseVisualPrompts()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generate session ID on component mount
  useEffect(() => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setChatSessionId(sessionId)
  }, [])

  // Get current visual analysis prompt (from Supabase or fallback)
  const getCurrentVisualPrompt = () => {
    if (visualAnalysisType === "custom") {
      return customPrompt
    }

    // Try to find in Supabase prompts first
    const supabasePrompt = supabaseVisualPrompts.find(
      (p) => p.id === visualAnalysisType || p.name === visualAnalysisType,
    )
    if (supabasePrompt) {
      return supabasePrompt.prompt
    }

    // Fallback to local prompts
    const fallbackPrompt =
      FALLBACK_VISUAL_ANALYSIS_PROMPTS[visualAnalysisType as keyof typeof FALLBACK_VISUAL_ANALYSIS_PROMPTS]
    return fallbackPrompt?.prompt || ""
  }

  // Get available visual analysis prompts (Supabase + fallback)
  const getAvailableVisualPrompts = () => {
    const prompts: any = {}

    // Add Supabase prompts
    supabaseVisualPrompts.forEach((prompt) => {
      prompts[prompt.id] = {
        name: prompt.name,
        icon: getIconForPrompt(prompt.icon_name),
        prompt: prompt.prompt,
        description: prompt.description || "",
        isSupabase: true,
      }
    })

    // Add fallback prompts if not already present
    Object.entries(FALLBACK_VISUAL_ANALYSIS_PROMPTS).forEach(([key, value]) => {
      if (!prompts[key]) {
        prompts[key] = {
          ...value,
          isSupabase: false,
        }
      }
    })

    return prompts
  }

  const getIconForPrompt = (iconName: string) => {
    switch (iconName) {
      case "eye":
        return <Eye className="w-4 h-4" />
      case "search":
        return <Search className="w-4 h-4" />
      case "type":
        return <Type className="w-4 h-4" />
      case "image":
        return <ImageIcon className="w-4 h-4" />
      case "file-text":
        return <FileText className="w-4 h-4" />
      default:
        return <Eye className="w-4 h-4" />
    }
  }

  // RAG functionality with Supabase documents
  const searchRAGDocuments = (query: string): string => {
    if (supabaseRAGDocuments.length === 0) return ""

    const queryLower = query.toLowerCase()
    const relevantDocs = supabaseRAGDocuments.filter(
      (doc) =>
        doc.title.toLowerCase().includes(queryLower) ||
        doc.content.toLowerCase().includes(queryLower) ||
        doc.category.toLowerCase().includes(queryLower) ||
        (doc.tags && doc.tags.some((tag) => tag.toLowerCase().includes(queryLower))),
    )

    if (relevantDocs.length === 0) return ""

    return relevantDocs.map((doc) => `[${doc.category}] ${doc.title}: ${doc.content}`).join("\n\n")
  }

  const handleAddRAGDocument = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim()) return

    try {
      const tags = newDocTags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
      await addRAGDocument(newDocTitle.trim(), newDocContent.trim(), newDocCategory, tags)
      setNewDocTitle("")
      setNewDocContent("")
      setNewDocTags("")
      addMessage("system", `📚 RAG文書「${newDocTitle}」をSupabaseに追加しました。`)
    } catch (error) {
      addMessage("system", `❌ RAG文書の追加に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
    }
  }

  const handleDeleteRAGDocument = async (id: string) => {
    try {
      await deleteRAGDocument(id)
      addMessage("system", "📚 RAG文書をSupabaseから削除しました。")
    } catch (error) {
      addMessage("system", `❌ RAG文書の削除に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
    }
  }

  const loadRAGFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const lines = content.split("\n").filter((line) => line.trim())

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line) {
            try {
              await addRAGDocument(`インポート文書 ${i + 1}`, line, "インポート", ["インポート"])
            } catch (error) {
              console.error(`Failed to add document ${i + 1}:`, error)
            }
          }
        }

        addMessage("system", `📚 ${lines.length}件のRAG文書をSupabaseにインポートしました。`)
      } catch (error) {
        addMessage("system", "❌ ファイルの読み込みに失敗しました。")
      }
    }
    reader.readAsText(file)
  }

  // Initialize with default system prompt from Supabase
  useEffect(() => {
    if (supabaseSystemPrompts.length > 0 && !selectedSystemPromptId) {
      const defaultPrompt = supabaseSystemPrompts.find((p) => p.is_default) || supabaseSystemPrompts[0]
      setSelectedSystemPromptId(defaultPrompt.id)
      setSystemPrompt(defaultPrompt.prompt)
      setTempSystemPrompt(defaultPrompt.prompt)
    }
  }, [supabaseSystemPrompts, selectedSystemPromptId])

  // メッセージを最下部にスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // モバイルデバイス検出
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase(),
      )
      setIsMobile(isMobileDevice)
    }

    checkMobile()
  }, [])

  // ブラウザ機能の検出
  useEffect(() => {
    const checkCapabilities = async () => {
      const caps = {
        camera: false,
        screenShare: false,
        speechRecognition: false,
        mobileScreenShare: false,
        multipleCameras: false,
      }

      // カメラアクセスの確認
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          caps.camera = true

          // Check for multiple cameras on mobile
          if (isMobile && navigator.mediaDevices.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter((device) => device.kind === "videoinput")
            caps.multipleCameras = videoDevices.length > 1
          }
        }
      } catch (error) {
        console.log("Camera not supported:", error)
      }

      // 画面共有の確認
      try {
        if (
          navigator.mediaDevices &&
          navigator.mediaDevices.getDisplayMedia &&
          typeof navigator.mediaDevices.getDisplayMedia === "function"
        ) {
          caps.screenShare = true

          // Check for mobile screen sharing support
          if (isMobile) {
            const userAgent = navigator.userAgent.toLowerCase()
            if (
              (userAgent.includes("safari") && !userAgent.includes("chrome") && /version\/1[5-9]/.test(userAgent)) ||
              (userAgent.includes("chrome") && /chrome\/(?:8[4-9]|9[0-9]|1[0-9][0-9])/.test(userAgent))
            ) {
              caps.mobileScreenShare = true
            }
          }
        }
      } catch (error) {
        console.log("Screen share not supported:", error)
      }

      // 音声認識の確認
      if (typeof window !== "undefined") {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (SpeechRecognition) {
          caps.speechRecognition = true
        }
      }

      setCapabilities(caps)

      // 初期メッセージ
      const availableFeatures = []
      if (caps.camera) availableFeatures.push("カメラ")
      if (caps.screenShare) availableFeatures.push("画面共有")
      if (caps.speechRecognition) availableFeatures.push("音声認識")

      if (availableFeatures.length > 0) {
        addMessage("system", `✅ 利用可能な機能: ${availableFeatures.join(", ")}`)
        if (caps.speechRecognition) {
          addMessage("system", "🎤 チャット入力欄のマイクアイコンで音声入力が利用できます。")
        }

        // Mobile-specific messages
        if (isMobile) {
          if (caps.multipleCameras) {
            addMessage("system", "📱 フロントカメラとリアカメラを切り替えることができます。")
          }
        }
      } else {
        addMessage("system", "⚠️ メディア機能が制限されています。")
      }

      // Supabase connection status
      if (!ragLoading && !systemPromptsLoading && !visualPromptsLoading) {
        if (supabaseRAGDocuments.length > 0 || supabaseSystemPrompts.length > 0 || supabaseVisualPrompts.length > 0) {
          addMessage(
            "system",
            `☁️ Supabaseに接続しました。RAG文書: ${supabaseRAGDocuments.length}件、システムプロンプト: ${supabaseSystemPrompts.length}件、解析プロンプト: ${supabaseVisualPrompts.length}件`,
          )
        } else {
          addMessage("system", "⚠️ Supabaseからのデータ取得に問題があります。ローカル設定を使用します。")
        }
      }
    }

    checkCapabilities()
  }, [
    isMobile,
    ragLoading,
    systemPromptsLoading,
    visualPromptsLoading,
    supabaseRAGDocuments.length,
    supabaseSystemPrompts.length,
    supabaseVisualPrompts.length,
  ])

  // API設定チェック
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch("/api/config")
        const config = await response.json()
        setApiStatus(config)

        if (config.gemini && config.tts) {
          addMessage("system", "✅ API設定が完了しました。顧客サポートシステムが利用可能です。")
        } else {
          addMessage("system", `⚠️ ${config.message}`)
        }
      } catch (error) {
        console.error("API設定チェックエラー:", error)
        setApiStatus({
          gemini: false,
          tts: false,
          message: "❌ API設定の確認に失敗しました。サーバー接続を確認してください。",
        })
        addMessage("system", "❌ API設定の確認に失敗しました。")
      }
    }

    checkApiStatus()
  }, [])

  // 音声認識の初期化
  useEffect(() => {
    if (capabilities.speechRecognition) {
      // Clean up previous recognition instance if it exists
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onresult = null
        recognitionRef.current.onstart = null
        recognitionRef.current.stop()
        recognitionRef.current = null
      }

      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
          console.error("Speech recognition not supported in this browser")
          return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = voiceLanguage

        recognition.onstart = () => {
          setIsListening(true)
        }

        recognition.onresult = (event) => {
          let interimTranscript = ""
          let finalTranscript = ""

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            const confidence = event.results[i][0].confidence

            if (event.results[i].isFinal) {
              finalTranscript += transcript
              setVoiceConfidence(confidence || 0)
            } else {
              interimTranscript += transcript
            }
          }

          setInterimTranscript(interimTranscript)

          if (finalTranscript) {
            setChatMessage(finalTranscript.trim())
            setInterimTranscript("")
          }
        }

        recognition.onerror = (event) => {
          console.error("音声認識エラー:", event.error)
          setIsListening(false)
          setInterimTranscript("")

          if (event.error === "not-allowed") {
            addMessage("system", "❌ 音声認識の許可が必要です。ブラウザの設定を確認してください。")
          } else if (event.error !== "no-speech" && event.error !== "aborted") {
            addMessage("system", `❌ 音声認識エラー: ${event.error}`)
          }
        }

        recognition.onend = () => {
          setIsListening(false)
          setInterimTranscript("")
        }

        recognitionRef.current = recognition
      } catch (error) {
        console.error("Speech recognition initialization error:", error)
        setCapabilities((prev) => ({ ...prev, speechRecognition: false }))
      }

      // Cleanup function
      return () => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.onend = null
            recognitionRef.current.onerror = null
            recognitionRef.current.onresult = null
            recognitionRef.current.onstart = null
            recognitionRef.current.stop()
          } catch (error) {
            console.error("Error cleaning up speech recognition:", error)
          }
        }
      }
    }
  }, [capabilities.speechRecognition, voiceLanguage])

  const addMessage = useCallback(
    (
      type: "user" | "ai" | "system" | "voice",
      content: string,
      isPeriodicAnalysis = false,
      isVoiceInput = false,
      hasImage = false,
      promptType?: string,
    ) => {
      const newMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        content,
        timestamp: new Date(),
        isPeriodicAnalysis,
        isVoiceInput,
        hasImage,
        promptType,
      }
      setMessages((prev) => [...prev, newMessage])
    },
    [],
  )

  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }
  }

  // カメラ切り替え機能
  const toggleCamera = async () => {
    if (!capabilities.multipleCameras || !isCapturing || captureMode !== "camera") {
      return
    }

    // 現在のストリームを停止
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    // カメラの向きを切り替え
    const newFacingMode = facingMode === "user" ? "environment" : "user"
    setFacingMode(newFacingMode)

    try {
      // Clear any previous camera errors
      setCameraError(null)

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      setStream(newStream)

      if (videoRef.current) {
        videoRef.current.srcObject = newStream

        // Make sure to wait for the video to be loaded
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play()
            console.log("Camera switched and playing successfully")
          } catch (playError) {
            console.error("Error playing video after camera switch:", playError)
            setCameraError("カメラの再生に失敗しました。ブラウザの設定を確認してください。")
          }
        }
      }

      addMessage("system", `📷 カメラを${newFacingMode === "user" ? "フロント" : "リア"}カメラに切り替えました。`)
    } catch (error) {
      console.error("カメラ切り替えエラー:", error)
      setCameraError(`カメラの切り替えに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
      addMessage(
        "system",
        `❌ カメラの切り替えに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      )
    }
  }

  // 画面共有を開始する関数
  const startScreenShare = async (): Promise<MediaStream> => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })

      mediaStream.getVideoTracks()[0].addEventListener("ended", () => {
        addMessage("system", "画面共有が停止されました。")
        stopCapture()
      })

      return mediaStream
    } catch (error) {
      if (isMobile) {
        console.error("Mobile screen sharing error:", error)
        throw new Error(
          "モバイルデバイスでの画面共有に失敗しました。ブラウザの制限により、一部のモバイルデバイスでは画面共有が利用できない場合があります。カメラモードをお試しください。",
        )
      }
      throw error
    }
  }

  // カメラを開始する関数
  const startCamera = async (): Promise<MediaStream> => {
    // Clear any previous camera errors
    setCameraError(null)

    // Try with exact constraints for better camera control
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: { exact: facingMode }, // Use exact to force the specific camera
      },
      audio: false,
    }

    try {
      console.log(`Attempting to access camera with facingMode: ${facingMode}`)
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      return mediaStream
    } catch (error) {
      console.error(`Failed to access camera with exact facingMode ${facingMode}:`, error)

      // If exact constraint fails, try with ideal (less strict)
      try {
        const fallbackConstraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: facingMode },
          },
          audio: false,
        }

        console.log("Trying with ideal facingMode constraint")
        const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints)
        return fallbackStream
      } catch (fallbackError) {
        console.error("Failed with ideal constraint too:", fallbackError)

        // Last resort: try with any camera
        try {
          console.log("Trying with any available camera")
          const lastResortStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })

          // If we get here with environment mode, we likely got the front camera
          if (facingMode === "environment") {
            setFacingMode("user")
            addMessage("system", "⚠️ リアカメラへのアクセスに失敗しました。フロントカメラを使用します。")
          }

          return lastResortStream
        } catch (lastError) {
          console.error("All camera access attempts failed:", lastError)
          setCameraError("カメラアクセスに失敗しました。ブラウザの設定でカメラの許可を確認してください。")
          throw new Error("カメラアクセスに失敗しました。ブラウザの設定でカメラの許可を確認してください。")
        }
      }
    }
  }

  // メインのキャプチャ開始関数
  const startCapture = async () => {
    try {
      let mediaStream: MediaStream

      if (captureMode === "screen") {
        if (!capabilities.screenShare) {
          throw new Error("画面共有がサポートされていません。カメラモードを選択してください。")
        }

        try {
          mediaStream = await startScreenShare()
          addMessage("system", "✅ 画面共有を開始しました。")
        } catch (error: any) {
          console.error("Screen share error:", error)

          if (error.name === "NotAllowedError") {
            addMessage("system", "⚠️ 画面共有が拒否されました。ブラウザで画面共有を許可してから再試行してください。")
            throw new Error("画面共有が拒否されました。")
          } else if (error.name === "NotSupportedError") {
            throw new Error("このブラウザでは画面共有がサポートされていません。")
          } else if (error.name === "AbortError") {
            addMessage("system", "⚠️ 画面共有がキャンセルされました。")
            throw new Error("画面共有がキャンセルされました。")
          } else {
            throw new Error(`画面共有エラー: ${error.message}`)
          }
        }
      } else {
        if (!capabilities.camera) {
          throw new Error("カメラがサポートされていません。")
        }

        try {
          mediaStream = await startCamera()
          addMessage(
            "system",
            `✅ カメラを開始しました。${isMobile && capabilities.multipleCameras ? `(${facingMode === "user" ? "フロント" : "リア"}カメラ使用中)` : ""}`,
          )
        } catch (error: any) {
          if (error.name === "NotAllowedError") {
            throw new Error("カメラアクセスが拒否されました。ブラウザの設定でカメラの許可を有効にしてください。")
          } else if (error.name === "NotFoundError") {
            throw new Error("カメラが見つかりません。カメラが接続されているか確認してください。")
          } else {
            throw new Error(`カメラアクセスエラー: ${error.message}`)
          }
        }
      }

      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        // Use onloadedmetadata to ensure the video is ready before playing
        videoRef.current.onloadedmetadata = async () => {
          try {
            if (videoRef.current) {
              await videoRef.current.play()
              console.log("Video is now playing")
            }
          } catch (playError) {
            console.error("Error playing video:", playError)
            setCameraError("ビデオの再生に失敗しました。ブラウザの設定を確認してください。")
          }
        }
      }

      setIsCapturing(true)
      // 定期的にキャプチャを実行（頻度が0より大きい場合のみ）
      if (Number.parseFloat(frequency) > 0) {
        // 最初のキャプチャを実行
        setTimeout(() => captureAndAnalyze(), 2000)

        // 定期的にキャプチャを実行
        intervalRef.current = setInterval(() => {
          captureAndAnalyze()
        }, Number.parseFloat(frequency) * 1000)

        const availablePrompts = getAvailableVisualPrompts()
        const currentPromptName = availablePrompts[visualAnalysisType]?.name || "不明"
        addMessage("system", `${frequency}秒間隔で画像解析を開始します。 (${currentPromptName}モード)`)
      } else {
        addMessage("system", "定期解析なしで開始しました。手動で解析を実行できます。")
      }
    } catch (error) {
      console.error("キャプチャ開始エラー:", error)
      addMessage("system", `❌ ${error instanceof Error ? error.message : "キャプチャの開始に失敗しました。"}`)
    }
  }

  const stopCapture = () => {
    stopCurrentAudio()

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsCapturing(false)
    setCameraError(null)
    addMessage("system", "キャプチャを停止しました。")
  }

  const captureCurrentFrame = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) {
      return null
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    // Check if video is ready
    if (video.readyState < 2) {
      console.log("Video not ready for capture, readyState:", video.readyState)
      return null
    }

    // Check if video dimensions are valid
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log("Invalid video dimensions:", video.videoWidth, video.videoHeight)
      return null
    }

    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw the current video frame to the canvas
      ctx.drawImage(video, 0, 0)

      // Convert to JPEG with 90% quality
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9)
      const base64Data = imageDataUrl.split(",")[1]

      return base64Data
    } catch (error) {
      console.error("Error capturing frame:", error)
      return null
    }
  }

  const captureAndAnalyze = async () => {
    const currentPrompt = getCurrentVisualPrompt()
    if (!currentPrompt.trim() || isProcessing) {
      return
    }

    setIsProcessing(true)

    try {
      const base64Data = await captureCurrentFrame()
      if (!base64Data) {
        throw new Error("フレームキャプチャに失敗しました")
      }

      const availablePrompts = getAvailableVisualPrompts()
      const promptName = availablePrompts[visualAnalysisType]?.name || "不明"
      const isActuallyPeriodic = Number.parseFloat(frequency) > 0
      addMessage(
        "system",
        `🔍 ${isActuallyPeriodic ? "定期解析中" : "手動解析中"}... (${promptName})`,
        isActuallyPeriodic,
      )

      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Language-Code": voiceLanguage,
        },
        body: JSON.stringify({
          image: base64Data,
          prompt: currentPrompt,
          mimeType: "image/jpeg",
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Only mark as periodic analysis if frequency > 0
        const isActuallyPeriodic = Number.parseFloat(frequency) > 0
        addMessage("ai", `[${promptName}] ${result.analysis}`, isActuallyPeriodic, false, true, promptName)

        if (result.analysis && isTTSEnabled) {
          speakText(result.analysis)
        }
      } else {
        addMessage("system", `❌ 解析エラー: ${result.error}`, isActuallyPeriodic)
        console.error("Analysis error:", result.error)
      }
    } catch (error) {
      console.error("解析エラー:", error)
      addMessage(
        "system",
        `❌ 解析エラー: ${error instanceof Error ? error.message : "不明なエラー"}`,
        Number.parseFloat(frequency) > 0,
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || isSendingChat) {
      return
    }

    const userMessage = chatMessage.trim()
    setChatMessage("")
    setIsSendingChat(true)

    try {
      addMessage("user", userMessage)

      const base64Data = await captureCurrentFrame()

      // Search RAG documents for relevant information
      const ragContext = searchRAGDocuments(userMessage)

      // Get current system prompt
      let currentSystemPrompt = systemPrompt
      if (selectedSystemPromptId) {
        const selectedPrompt = supabaseSystemPrompts.find((p) => p.id === selectedSystemPromptId)
        if (selectedPrompt) {
          currentSystemPrompt = selectedPrompt.prompt
        }
      }

      // Enhance system prompt with RAG context if available
      let enhancedSystemPrompt = currentSystemPrompt
      if (ragContext) {
        enhancedSystemPrompt += `\n\n【参考情報】\n以下の情報も参考にして回答してください：\n${ragContext}`
      }

      const requestBody: any = {
        prompt: userMessage,
        systemPrompt: enhancedSystemPrompt,
        sessionId: chatSessionId,
        mimeType: "image/jpeg",
      }

      if (base64Data) {
        requestBody.image = base64Data
        addMessage("system", "📸 現在の画像と一緒にメッセージを送信中...")
      } else {
        addMessage("system", "💬 テキストメッセージを送信中...")
      }

      // Use the new chat-with-history endpoint
      const response = await fetch("/api/chat-with-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Language-Code": voiceLanguage,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result.success) {
        const responsePrefix = ragContext ? "[RAG強化] " : ""
        const contextPrefix = "[履歴付き] "
        addMessage(
          "ai",
          `${contextPrefix}${responsePrefix}${result.response}`,
          false,
          false,
          !!base64Data,
          "システムプロンプト",
        )

        if (result.response && isTTSEnabled) {
          speakText(result.response)
        }

        // Update session ID if provided
        if (result.sessionId && result.sessionId !== chatSessionId) {
          setChatSessionId(result.sessionId)
        }
      } else {
        addMessage("system", `❌ チャットエラー: ${result.error}`)
        console.error("Chat error:", result.error)
      }
    } catch (error) {
      console.error("チャット送信エラー:", error)
      addMessage("system", `❌ チャット送信エラー: ${error instanceof Error ? error.message : "不明なエラー"}`)
    } finally {
      setIsSendingChat(false)

      // Focus back on the chat input after sending
      setTimeout(() => {
        chatInputRef.current?.focus()
      }, 100)
    }
  }

  const speakText = async (text: string) => {
    try {
      stopCurrentAudio()

      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Language-Code": voiceLanguage,
        },
        body: JSON.stringify({ text }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        currentAudioRef.current = audio

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
        }

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
        }

        await audio.play()
      } else {
        console.error("TTS API error:", await response.text())
      }
    } catch (error) {
      console.error("音声合成エラー:", error)
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      addMessage("system", "❌ 音声認識がサポートされていません。")
      return
    }

    if (isListening) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.error("Error stopping speech recognition:", error)
      }
    } else {
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.error("Error starting speech recognition:", error)
        addMessage("system", "❌ 音声認識の開始に失敗しました。ブラウザの設定を確認してください。")
      }
    }
  }

  const manualCapture = () => {
    if (isCapturing && !isProcessing) {
      captureAndAnalyze()
    }
  }

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  const toggleTTS = () => {
    if (!isTTSEnabled) {
      setIsTTSEnabled(true)
      addMessage("system", "🔊 音声読み上げを有効にしました。")
    } else {
      setIsTTSEnabled(false)
      stopCurrentAudio()
      addMessage("system", "🔇 音声読み上げを無効にしました。")
    }
  }

  const handleCaptureModeChange = (value: "camera" | "screen") => {
    if (value === "screen") {
      if (!capabilities.screenShare) {
        addMessage("system", "⚠️ 画面共有が利用できません。カメラモードを使用してください。")
        return
      }
    }
    setCaptureMode(value)
  }

  const saveSystemPrompt = () => {
    setSystemPrompt(tempSystemPrompt)
    addMessage("system", "✅ システムプロンプトを保存しました。")
  }

  const resetSystemPrompt = () => {
    const defaultPrompt = supabaseSystemPrompts.find((p) => p.is_default)?.prompt || DEFAULT_SYSTEM_PROMPT
    setTempSystemPrompt(defaultPrompt)
    setSystemPrompt(defaultPrompt)
    addMessage("system", "🔄 システムプロンプトをデフォルトに戻しました。")
  }

  const handleSystemPromptChange = (promptId: string) => {
    setSelectedSystemPromptId(promptId)
    const selectedPrompt = supabaseSystemPrompts.find((p) => p.id === promptId)
    if (selectedPrompt) {
      setSystemPrompt(selectedPrompt.prompt)
      setTempSystemPrompt(selectedPrompt.prompt)
      addMessage("system", `✅ システムプロンプト「${selectedPrompt.name}」を選択しました。`)
    }
  }

  // API状態
  const [apiStatus, setApiStatus] = useState<{
    gemini: boolean
    tts: boolean
    message: string
  }>({ gemini: false, tts: false, message: "設定を確認中..." })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Layout */}
      {isMobile ? (
        <div className="flex flex-col h-screen">
          {/* Mobile Header with Settings */}
          <div className="bg-white border-b p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <span className="font-semibold">AI Vision Chat</span>
              {supabaseRAGDocuments.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Cloud className="w-3 h-3 mr-1" />
                  Supabase
                </Badge>
              )}
            </div>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>設定</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">一般</TabsTrigger>
                    <TabsTrigger value="prompts">プロンプト</TabsTrigger>
                    <TabsTrigger value="rag">RAG</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4">
                    {/* API Status */}
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center gap-2">
                        {apiStatus.gemini && apiStatus.tts ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        {apiStatus.message}
                      </AlertDescription>
                    </Alert>

                    {/* Supabase Status */}
                    <Alert>
                      <Cloud className="h-4 w-4" />
                      <AlertDescription>
                        <div className="text-sm">
                          <div className="font-medium mb-1">Supabase接続状況:</div>
                          {ragLoading || systemPromptsLoading || visualPromptsLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              接続中...
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>RAG文書: {supabaseRAGDocuments.length}件</div>
                              <div>システムプロンプト: {supabaseSystemPrompts.length}件</div>
                              <div>解析プロンプト: {supabaseVisualPrompts.length}件</div>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>

                    {/* Capture Mode */}
                    <div>
                      <Label className="text-sm font-medium">キャプチャモード</Label>
                      <RadioGroup
                        value={captureMode}
                        onValueChange={handleCaptureModeChange}
                        className="flex gap-4 mt-2"
                        disabled={isCapturing}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="camera" id="mobile-camera" disabled={!capabilities.camera} />
                          <Label htmlFor="mobile-camera" className="text-sm flex items-center gap-1">
                            <Camera className="w-3 h-3" />
                            カメラ
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="screen" id="mobile-screen" disabled={!capabilities.screenShare} />
                          <Label htmlFor="mobile-screen" className="text-sm flex items-center gap-1">
                            <Monitor className="w-3 h-3" />
                            画面共有
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Analysis Type */}
                    <div>
                      <Label className="text-sm font-medium">解析タイプ</Label>
                      <Select value={visualAnalysisType} onValueChange={setVisualAnalysisType} disabled={isCapturing}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(getAvailableVisualPrompts()).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                {config.icon}
                                <div>
                                  <div className="font-medium">{config.name}</div>
                                  {config.isSupabase && (
                                    <Badge variant="outline" className="text-xs">
                                      Supabase
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Prompt */}
                    {visualAnalysisType === "custom" && (
                      <div>
                        <Label className="text-sm font-medium">カスタムプロンプト</Label>
                        <Textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="独自の画像解析プロンプトを入力してください..."
                          className="mt-2"
                          disabled={isCapturing}
                        />
                      </div>
                    )}

                    {/* Frequency */}
                    <div>
                      <Label className="text-sm font-medium">キャプチャ頻度</Label>
                      <Select value={frequency} onValueChange={setFrequency} disabled={isCapturing}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">定期解析なし</SelectItem>
                          <SelectItem value="3">3秒</SelectItem>
                          <SelectItem value="5">5秒</SelectItem>
                          <SelectItem value="10">10秒</SelectItem>
                          <SelectItem value="20">20秒</SelectItem>
                          <SelectItem value="30">30秒</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Language Settings */}
                    <div>
                      <Label className="text-sm font-medium">言語設定</Label>
                      <Select
                        value={interfaceLanguage}
                        onValueChange={(value) => {
                          setInterfaceLanguage(value)
                          switch (value) {
                            case "ja":
                              setVoiceLanguage("ja-JP")
                              break
                            case "en":
                              setVoiceLanguage("en-US")
                              break
                            case "zh":
                              setVoiceLanguage("zh-CN")
                              break
                            case "ko":
                              setVoiceLanguage("ko-KR")
                              break
                            default:
                              setVoiceLanguage("ja-JP")
                          }
                        }}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ja">日本語</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="zh">中文</SelectItem>
                          <SelectItem value="ko">한국어</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="prompts" className="space-y-4">
                    {/* System Prompt Selection */}
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        システムプロンプト選択
                      </Label>
                      {systemPromptsLoading ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          読み込み中...
                        </div>
                      ) : (
                        <Select value={selectedSystemPromptId} onValueChange={handleSystemPromptChange}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="システムプロンプトを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {supabaseSystemPrompts.map((prompt) => (
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
                      )}
                    </div>

                    {/* System Prompt Editor */}
                    <div>
                      <Label className="text-sm font-medium">システムプロンプト編集</Label>
                      <Textarea
                        value={tempSystemPrompt}
                        onChange={(e) => setTempSystemPrompt(e.target.value)}
                        placeholder="システムプロンプトを入力してください..."
                        className="mt-2 min-h-[200px]"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button onClick={saveSystemPrompt} size="sm">
                          <Save className="w-3 h-3 mr-1" />
                          保存
                        </Button>
                        <Button onClick={resetSystemPrompt} variant="outline" size="sm">
                          <RotateCcw className="w-3 h-3 mr-1" />
                          リセット
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="rag" className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        RAG文書管理 (Supabase)
                      </Label>

                      {/* Add new document */}
                      <div className="space-y-2 mt-2">
                        <Input
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          placeholder="文書タイトル"
                        />
                        <Select value={newDocCategory} onValueChange={setNewDocCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FAQ">FAQ</SelectItem>
                            <SelectItem value="製品情報">製品情報</SelectItem>
                            <SelectItem value="手順書">手順書</SelectItem>
                            <SelectItem value="サポート">サポート</SelectItem>
                            <SelectItem value="その他">その他</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={newDocTags}
                          onChange={(e) => setNewDocTags(e.target.value)}
                          placeholder="タグ (カンマ区切り)"
                        />
                        <Textarea
                          value={newDocContent}
                          onChange={(e) => setNewDocContent(e.target.value)}
                          placeholder="文書内容"
                          className="min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={handleAddRAGDocument}
                            size="sm"
                            disabled={!newDocTitle.trim() || !newDocContent.trim()}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            追加
                          </Button>
                          <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                            <Upload className="w-3 h-3 mr-1" />
                            ファイル
                          </Button>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.csv"
                          onChange={loadRAGFromFile}
                          className="hidden"
                        />
                      </div>

                      {/* Document list */}
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {ragLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            読み込み中...
                          </div>
                        ) : supabaseRAGDocuments.length > 0 ? (
                          supabaseRAGDocuments.map((doc) => (
                            <div key={doc.id} className="p-2 border rounded text-xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    [{doc.category}] {doc.title}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    <Cloud className="w-2 h-2 mr-1" />
                                    Supabase
                                  </Badge>
                                </div>
                                <Button
                                  onClick={() => handleDeleteRAGDocument(doc.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {doc.tags.map((tag, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <p className="text-gray-600 truncate mt-1">{doc.content}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-gray-500 text-sm py-4">RAG文書がありません</div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>

          {/* Mobile Chat Area */}
          <div className="flex-1 flex flex-col bg-white">
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === "user" || message.type === "voice" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-2 rounded-lg text-sm ${
                        message.type === "user"
                          ? "bg-blue-500 text-white"
                          : message.type === "voice"
                            ? "bg-purple-500 text-white"
                            : message.type === "system"
                              ? "bg-gray-100 text-gray-700 border"
                              : message.isPeriodicAnalysis
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : "bg-green-100 text-green-800"
                      }`}
                    >
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs opacity-70">{message.timestamp.toLocaleTimeString()}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {message.isVoiceInput && (
                            <span className="text-xs bg-purple-200 text-purple-700 px-1 py-0.5 rounded">音声</span>
                          )}
                          {message.isPeriodicAnalysis && (
                            <span className="text-xs bg-purple-200 text-purple-700 px-1 py-0.5 rounded">定期</span>
                          )}
                          {message.hasImage && (
                            <span className="text-xs bg-blue-200 text-blue-700 px-1 py-0.5 rounded">画像</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Mobile Video Preview - Fixed position */}
            <div className="p-3 border-t bg-gray-50">
              <div className="relative">
                {cameraError && (
                  <Alert variant="destructive" className="mb-2 py-1">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">{cameraError}</AlertDescription>
                  </Alert>
                )}

                <video
                  ref={videoRef}
                  className="w-full rounded-lg bg-black"
                  style={{ height: "120px", objectFit: "cover" }}
                  muted
                  playsInline
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" />

                {isProcessing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-xs">解析中...</div>
                  </div>
                )}

                {isCapturing && (
                  <div className="absolute top-1 left-1 bg-red-500 text-white px-1 py-0.5 rounded text-xs">
                    {captureMode === "screen" ? "画面共有中" : "カメラ撮影中"}
                    {captureMode === "camera" &&
                      isMobile &&
                      capabilities.multipleCameras &&
                      ` (${facingMode === "user" ? "フロント" : "リア"})`}
                  </div>
                )}

                {/* Control buttons overlay */}
                <div className="absolute bottom-1 right-1 flex gap-1">
                  {isMobile && capabilities.multipleCameras && captureMode === "camera" && isCapturing && (
                    <Button onClick={toggleCamera} variant="secondary" size="sm" className="h-6 px-2 text-xs">
                      <FlipHorizontal className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    onClick={isCapturing ? stopCapture : startCapture}
                    disabled={
                      (visualAnalysisType === "custom" && !customPrompt.trim()) ||
                      (visualAnalysisType !== "custom" && !getCurrentVisualPrompt().trim()) ||
                      !apiStatus.gemini ||
                      !apiStatus.tts ||
                      (!capabilities.camera && !capabilities.screenShare)
                    }
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    {isCapturing ? (
                      <>
                        <Square className="w-3 h-3 mr-1" />
                        停止
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        開始
                      </>
                    )}
                  </Button>
                  {isCapturing && (
                    <Button
                      onClick={manualCapture}
                      disabled={isProcessing}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                    >
                      解析
                    </Button>
                  )}
                  <Button onClick={toggleTTS} variant="outline" size="sm" className="h-6 px-2">
                    {isTTSEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile Chat Input - Fixed at bottom */}
            <div className="p-3 border-t bg-white">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Textarea
                    ref={chatInputRef}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder={interimTranscript || "メッセージを入力..."}
                    className="flex-1 min-h-[40px] max-h-[80px] text-sm pr-8 resize-none"
                    disabled={isSendingChat}
                  />
                  {capabilities.speechRecognition && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleListening}
                      className={`absolute right-1 bottom-1 h-6 w-6 p-0 ${isListening ? "bg-red-100" : ""}`}
                    >
                      {isListening ? (
                        <Mic className="w-3 h-3 text-red-500" />
                      ) : (
                        <MicOff className="w-3 h-3 text-gray-500" />
                      )}
                    </Button>
                  )}
                </div>
                <Button
                  onClick={sendChatMessage}
                  disabled={!chatMessage.trim() || isSendingChat || !apiStatus.gemini}
                  size="sm"
                  className="h-auto px-3"
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Desktop Layout */
        <div className="p-4">
          <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">
            {/* Left Panel - Desktop Settings */}
            <Card className="col-span-1 self-start sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  AI Vision Chat
                  {supabaseRAGDocuments.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Cloud className="w-3 h-3 mr-1" />
                      Supabase
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">一般</TabsTrigger>
                    <TabsTrigger value="prompts">プロンプト</TabsTrigger>
                    <TabsTrigger value="rag">RAG</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4">
                    {/* API Status */}
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center gap-2">
                        {apiStatus.gemini && apiStatus.tts ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        {apiStatus.message}
                      </AlertDescription>
                    </Alert>

                    {/* Supabase Status */}
                    <Alert>
                      <Cloud className="h-4 w-4" />
                      <AlertDescription>
                        <div className="text-sm">
                          <div className="font-medium mb-2">Supabase接続状況:</div>
                          {ragLoading || systemPromptsLoading || visualPromptsLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              接続中...
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>RAG文書: {supabaseRAGDocuments.length}件</div>
                              <div>システムプロンプト: {supabaseSystemPrompts.length}件</div>
                              <div>解析プロンプト: {supabaseVisualPrompts.length}件</div>
                              <div className="text-xs text-gray-500 mt-2">セッションID: {chatSessionId.slice(-8)}</div>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>

                    {/* Capture Mode */}
                    <div>
                      <Label className="text-base font-medium">キャプチャモード</Label>
                      <RadioGroup
                        value={captureMode}
                        onValueChange={handleCaptureModeChange}
                        className="flex gap-6 mt-2"
                        disabled={isCapturing}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="camera" id="camera" disabled={!capabilities.camera} />
                          <Label
                            htmlFor="camera"
                            className={`flex items-center gap-2 ${!capabilities.camera ? "opacity-50" : ""}`}
                          >
                            <Camera className="w-4 h-4" />
                            カメラ
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="screen" id="screen" disabled={!capabilities.screenShare} />
                          <Label
                            htmlFor="screen"
                            className={`flex items-center gap-2 ${!capabilities.screenShare ? "opacity-50" : ""}`}
                          >
                            <Monitor className="w-4 h-4" />
                            画面共有
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Camera Switch for Mobile */}
                    {isMobile && capabilities.multipleCameras && captureMode === "camera" && (
                      <div>
                        <Button
                          onClick={toggleCamera}
                          variant="outline"
                          className="w-full"
                          disabled={!capabilities.multipleCameras || isCapturing === false}
                        >
                          <FlipHorizontal className="w-4 h-4 mr-2" />
                          {facingMode === "user" ? "リアカメラに切替" : "フロントカメラに切替"}
                        </Button>
                      </div>
                    )}

                    {/* Analysis Type */}
                    <div>
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        画像解析プロンプト
                      </Label>
                      <Select value={visualAnalysisType} onValueChange={setVisualAnalysisType} disabled={isCapturing}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(getAvailableVisualPrompts()).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                {config.icon}
                                <div>
                                  <div className="font-medium">{config.name}</div>
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    {config.description}
                                    {config.isSupabase && (
                                      <Badge variant="outline" className="text-xs">
                                        Supabase
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Prompt */}
                    {visualAnalysisType === "custom" && (
                      <div>
                        <Label htmlFor="customPrompt" className="text-base font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          カスタムプロンプト
                        </Label>
                        <Textarea
                          id="customPrompt"
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="独自の画像解析プロンプトを入力してください..."
                          className="mt-2 min-h-[80px]"
                          disabled={isCapturing}
                        />
                      </div>
                    )}

                    {/* Frequency */}
                    <div>
                      <Label className="text-base font-medium">キャプチャ頻度</Label>
                      <Select value={frequency} onValueChange={setFrequency} disabled={isCapturing}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">定期解析なし</SelectItem>
                          <SelectItem value="0.5">0.5秒</SelectItem>
                          <SelectItem value="1">1秒</SelectItem>
                          <SelectItem value="3">3秒</SelectItem>
                          <SelectItem value="5">5秒</SelectItem>
                          <SelectItem value="10">10秒</SelectItem>
                          <SelectItem value="20">20秒</SelectItem>
                          <SelectItem value="30">30秒</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Language Settings */}
                    <div>
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        言語設定
                      </Label>
                      <Select
                        value={interfaceLanguage}
                        onValueChange={(value) => {
                          setInterfaceLanguage(value)
                          switch (value) {
                            case "ja":
                              setVoiceLanguage("ja-JP")
                              break
                            case "en":
                              setVoiceLanguage("en-US")
                              break
                            case "zh":
                              setVoiceLanguage("zh-CN")
                              break
                            case "ko":
                              setVoiceLanguage("ko-KR")
                              break
                            default:
                              setVoiceLanguage("ja-JP")
                          }
                        }}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ja">日本語</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="zh">中文</SelectItem>
                          <SelectItem value="ko">한국어</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Control Buttons */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button
                          onClick={isCapturing ? stopCapture : startCapture}
                          disabled={
                            (visualAnalysisType === "custom" && !customPrompt.trim()) ||
                            (visualAnalysisType !== "custom" && !getCurrentVisualPrompt().trim()) ||
                            !apiStatus.gemini ||
                            !apiStatus.tts ||
                            (!capabilities.camera && !capabilities.screenShare)
                          }
                          className="flex-1"
                          size="lg"
                        >
                          {isCapturing ? (
                            <>
                              <Square className="w-4 h-4 mr-2" />
                              停止
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              開始
                            </>
                          )}
                        </Button>

                        <Button onClick={toggleTTS} variant="outline" size="lg">
                          {isTTSEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </Button>
                      </div>

                      {isCapturing && Number.parseFloat(frequency) >= 0 && (
                        <Button onClick={manualCapture} disabled={isProcessing} variant="outline" className="w-full">
                          {isProcessing ? "処理中..." : "今すぐ解析"}
                        </Button>
                      )}
                    </div>

                    {/* Video Preview */}
                    <div className="relative">
                      {cameraError && (
                        <Alert variant="destructive" className="mb-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                        </Alert>
                      )}

                      <video
                        ref={videoRef}
                        className="w-full rounded-lg bg-black"
                        style={{ maxHeight: "200px", objectFit: "contain" }}
                        muted
                        playsInline
                        autoPlay
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      {isProcessing && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                          <div className="text-white text-sm">解析中...</div>
                        </div>
                      )}

                      {isCapturing && (
                        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                          {captureMode === "screen" ? "画面共有中" : "カメラ撮影中"}
                          {captureMode === "camera" &&
                            isMobile &&
                            capabilities.multipleCameras &&
                            ` (${facingMode === "user" ? "フロント" : "リア"})`}
                        </div>
                      )}

                      {isCapturing && (
                        <div className="absolute bottom-2 left-2 bg-purple-500 text-white px-2 py-1 rounded text-xs">
                          {getAvailableVisualPrompts()[visualAnalysisType]?.name || "不明"}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="prompts" className="space-y-4">
                    {/* System Prompt Selection */}
                    <div>
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        システムプロンプト選択
                      </Label>
                      {systemPromptsLoading ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          読み込み中...
                        </div>
                      ) : (
                        <Select value={selectedSystemPromptId} onValueChange={handleSystemPromptChange}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="システムプロンプトを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {supabaseSystemPrompts.map((prompt) => (
                              <SelectItem key={prompt.id} value={prompt.id}>
                                <div className="flex items-center gap-2">
                                  {prompt.name}
                                  {prompt.is_default && (
                                    <Badge variant="default" className="text-xs">
                                      デフォルト
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    <Cloud className="w-2 h-2 mr-1" />
                                    Supabase
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* System Prompt Editor */}
                    <div>
                      <Label className="text-base font-medium">システムプロンプト編集</Label>
                      <Textarea
                        value={tempSystemPrompt}
                        onChange={(e) => setTempSystemPrompt(e.target.value)}
                        placeholder="システムプロンプトを入力してください..."
                        className="mt-2 min-h-[300px]"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button onClick={saveSystemPrompt} size="sm">
                          <Save className="w-3 h-3 mr-1" />
                          保存
                        </Button>
                        <Button onClick={resetSystemPrompt} variant="outline" size="sm">
                          <RotateCcw className="w-3 h-3 mr-1" />
                          リセット
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="rag" className="space-y-4">
                    <div>
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        RAG文書管理 (Supabase)
                      </Label>

                      {/* Add new document */}
                      <div className="space-y-2 mt-2">
                        <Input
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          placeholder="文書タイトル"
                        />
                        <Select value={newDocCategory} onValueChange={setNewDocCategory}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FAQ">FAQ</SelectItem>
                            <SelectItem value="製品情報">製品情報</SelectItem>
                            <SelectItem value="手順書">手順書</SelectItem>
                            <SelectItem value="サポート">サポート</SelectItem>
                            <SelectItem value="その他">その他</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={newDocTags}
                          onChange={(e) => setNewDocTags(e.target.value)}
                          placeholder="タグ (カンマ区切り)"
                        />
                        <Textarea
                          value={newDocContent}
                          onChange={(e) => setNewDocContent(e.target.value)}
                          placeholder="文書内容"
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={handleAddRAGDocument}
                            size="sm"
                            disabled={!newDocTitle.trim() || !newDocContent.trim()}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            追加
                          </Button>
                          <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                            <Upload className="w-3 h-3 mr-1" />
                            ファイル
                          </Button>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.csv"
                          onChange={loadRAGFromFile}
                          className="hidden"
                        />
                      </div>

                      {/* Document list */}
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {ragLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            読み込み中...
                          </div>
                        ) : supabaseRAGDocuments.length > 0 ? (
                          supabaseRAGDocuments.map((doc) => (
                            <div key={doc.id} className="p-2 border rounded text-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    [{doc.category}] {doc.title}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    <Cloud className="w-2 h-2 mr-1" />
                                    Supabase
                                  </Badge>
                                </div>
                                <Button
                                  onClick={() => handleDeleteRAGDocument(doc.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {doc.tags.map((tag, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <p className="text-gray-600 text-xs mt-1">{doc.content}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-gray-500 text-sm py-4">RAG文書がありません</div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Right Panel - Desktop Chat */}
            <Card className="col-span-2 flex flex-col" style={{ minHeight: "calc(100vh - 2rem)" }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  顧客サポートチャット
                  {supabaseRAGDocuments.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      RAG有効 ({supabaseRAGDocuments.length}件)
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    履歴管理
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-grow p-4 pt-0">
                <ScrollArea className="flex-grow pr-4 mb-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.type === "user" || message.type === "voice" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.type === "user"
                              ? "bg-blue-500 text-white"
                              : message.type === "voice"
                                ? "bg-purple-500 text-white"
                                : message.type === "system"
                                  ? "bg-gray-100 text-gray-700 border"
                                  : message.isPeriodicAnalysis
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-green-100 text-green-800"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs opacity-70">{message.timestamp.toLocaleTimeString()}</p>
                            <div className="flex items-center gap-1">
                              {message.isVoiceInput && (
                                <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded">
                                  音声入力
                                </span>
                              )}
                              {message.isPeriodicAnalysis && (
                                <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded">
                                  定期解析
                                </span>
                              )}
                              {message.hasImage && (
                                <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded">画像付き</span>
                              )}
                              {message.promptType && (
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                  {message.promptType}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Desktop Chat Input */}
                <div className="border-t pt-4 mt-auto">
                  <Label htmlFor="chatMessage" className="text-sm font-medium flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4" />
                    リアルタイムチャット (履歴管理付き)
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Textarea
                        id="chatMessage"
                        ref={chatInputRef}
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyPress={handleChatKeyPress}
                        placeholder={
                          interimTranscript || "メッセージを入力してください... (Enterで送信、Shift+Enterで改行)"
                        }
                        className="flex-1 min-h-[60px] max-h-[120px] pr-10"
                        disabled={isSendingChat}
                      />
                      {capabilities.speechRecognition && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleListening}
                          disabled={!capabilities.speechRecognition}
                          className={`absolute right-2 bottom-2 h-8 w-8 p-0 ${isListening ? "bg-red-100" : ""}`}
                        >
                          {isListening ? (
                            <Mic className="w-4 h-4 text-red-500" />
                          ) : (
                            <MicOff className="w-4 h-4 text-gray-500" />
                          )}
                        </Button>
                      )}
                    </div>
                    <Button
                      onClick={sendChatMessage}
                      disabled={!chatMessage.trim() || isSendingChat || !apiStatus.gemini}
                      size="sm"
                      className="h-auto"
                    >
                      {isSendingChat ? (
                        "送信中..."
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
