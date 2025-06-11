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
  Info,
  Headphones,
  Settings,
  FileText,
  Search,
  Type,
  ImageIcon,
  FlipHorizontal,
  Smartphone,
  MessageSquare,
  Send,
} from "lucide-react"

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

// Visual Analysis Prompt Templates
const VISUAL_ANALYSIS_PROMPTS = {
  simple_detection: {
    name: "簡易物体検知",
    icon: <Search className="w-4 h-4" />,
    prompt: "映った物体名を詳細に確認し、商品名などを簡潔に回答してください。",
    description: "基本的な物体の識別と商品名の特定",
  },
  detailed_detection: {
    name: "物体詳細検知",
    icon: <Eye className="w-4 h-4" />,
    prompt:
      "映った物体名を詳細に確認し、商品名や型番が特定出来たらWebで検索して詳しい特徴などを調べた結果を簡潔に回答してください。",
    description: "詳細な物体分析と仕様情報の提供",
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

// System Prompt (Customer Support Professional)
const SYSTEM_PROMPT = `あなたは顧客サポートのプロフェッショナルです。現在、ユーザーから音声またはチャットで問い合わせが寄せられています。
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
  const [visualAnalysisType, setVisualAnalysisType] = useState<keyof typeof VISUAL_ANALYSIS_PROMPTS>("simple_detection")
  const [customPrompt, setCustomPrompt] = useState("この画像に何が写っていますか？")
  const [chatMessage, setChatMessage] = useState("")
  const [frequency, setFrequency] = useState("0")
  const [isCapturing, setIsCapturing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState("ja-JP")
  const [interfaceLanguage, setInterfaceLanguage] = useState("ja")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [voiceConfidence, setVoiceConfidence] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment") // Default to rear camera
  const [capabilities, setCapabilities] = useState({
    camera: false,
    screenShare: false,
    speechRecognition: false,
    mobileScreenShare: false,
    multipleCameras: false,
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get current visual analysis prompt
  const getCurrentVisualPrompt = () => {
    if (visualAnalysisType === "custom") {
      return customPrompt
    }
    return VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].prompt
  }

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
          // Note: This is a best-effort detection as browser support varies
          if (isMobile) {
            // iOS Safari 15+ and Android Chrome 84+ support screen sharing
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
          addMessage("system", "🎤 音声入力を有効にして、声で操作を開始できます。")
        }

        // Mobile-specific messages
        if (isMobile) {
          if (caps.multipleCameras) {
            addMessage("system", "📱 フロントカメラとリアカメラを切り替えることができます。")
          }

          if (caps.mobileScreenShare) {
            addMessage("system", "📱 このモバイルデバイスでは画面共有が利用可能です。")
          } else if (caps.screenShare) {
            addMessage("system", "⚠️ モバイルデバイスでの画面共有は制限されている場合があります。")
          }
        }
      } else {
        addMessage("system", "⚠️ メディア機能が制限されています。")
      }
    }

    checkCapabilities()
  }, [isMobile])

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
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = voiceLanguage

        recognition.onstart = () => {
          setIsListening(true)
          addMessage("system", "🎤 音声認識を開始しました。話しかけてください。")
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
            handleVoiceInput(finalTranscript.trim())
            setInterimTranscript("")
          }
        }

        recognition.onerror = (event) => {
          console.error("音声認識エラー:", event.error)
          setIsListening(false)
          setInterimTranscript("")

          // Only show errors that are not "no-speech" to reduce noise
          if (event.error === "not-allowed") {
            addMessage("system", "❌ 音声認識の許可が必要です。ブラウザの設定を確認してください。")
          } else if (event.error !== "no-speech" && event.error !== "aborted") {
            // Skip showing no-speech and aborted errors to reduce noise
            addMessage("system", `❌ 音声認識エラー: ${event.error}`)
          }
        }

        recognition.onend = () => {
          setIsListening(false)
          setInterimTranscript("")

          // Only restart if voice mode is still active and we're not intentionally stopping
          if (isVoiceMode) {
            // Add a small delay before restarting to prevent rapid restarts
            setTimeout(() => {
              try {
                if (isVoiceMode && recognitionRef.current === recognition) {
                  recognition.start()
                }
              } catch (error) {
                console.error("Failed to restart speech recognition:", error)
              }
            }, 1000)
          }
        }

        recognitionRef.current = recognition

        // Start recognition if voice mode is already active
        if (isVoiceMode && !isListening) {
          try {
            recognition.start()
          } catch (error) {
            console.error("Failed to start speech recognition:", error)
          }
        }
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
  }, [capabilities.speechRecognition, voiceLanguage, isVoiceMode])

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

  // 音声入力の処理
  const handleVoiceInput = async (transcript: string) => {
    addMessage("voice", transcript, false, true)

    // 音声コマンドの解析
    const lowerTranscript = transcript.toLowerCase()

    if (
      lowerTranscript.includes("画面共有") ||
      lowerTranscript.includes("スクリーン") ||
      lowerTranscript.includes("画面を共有")
    ) {
      addMessage("system", "🖥️ 画面共有を開始します...")
      setCaptureMode("screen")
      setTimeout(() => startCapture(), 1000)
    } else if (lowerTranscript.includes("カメラ") || lowerTranscript.includes("カメラを開始")) {
      addMessage("system", "📷 カメラを開始します...")
      setCaptureMode("camera")
      setTimeout(() => startCapture(), 1000)
    } else if (lowerTranscript.includes("カメラ切替") || lowerTranscript.includes("カメラを切り替え")) {
      if (capabilities.multipleCameras) {
        toggleCamera()
      } else {
        addMessage("system", "⚠️ カメラの切り替えはこのデバイスでは利用できません。")
      }
    } else if (lowerTranscript.includes("停止") || lowerTranscript.includes("止めて")) {
      addMessage("system", "⏹️ キャプチャを停止します...")
      stopCapture()
    } else if (lowerTranscript.includes("音声入力終了") || lowerTranscript.includes("音声を止めて")) {
      toggleVoiceMode()
    } else {
      // 通常のチャットメッセージとして処理（システムプロンプト使用）
      await sendVoiceMessage(transcript)
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
        await videoRef.current.play()
      }

      addMessage("system", `📷 カメラを${newFacingMode === "user" ? "フロント" : "リア"}カメラに切り替えました。`)
    } catch (error) {
      console.error("カメラ切り替えエラー:", error)
      addMessage(
        "system",
        `❌ カメラの切り替えに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      )
    }
  }

  // 音声メッセージの送信（システムプロンプト使用）
  const sendVoiceMessage = async (message: string) => {
    if (isSendingChat) return

    setIsSendingChat(true)

    try {
      // 現在のフレームをキャプチャ（利用可能な場合）
      const base64Data = await captureCurrentFrame()

      const requestBody: any = {
        prompt: message,
        systemPrompt: SYSTEM_PROMPT,
        mimeType: "image/jpeg",
      }

      if (base64Data) {
        requestBody.image = base64Data
        addMessage("system", "📸 音声入力と現在の画像を一緒に送信中...")
      } else {
        addMessage("system", "💬 音声入力を送信中...")
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Language-Code": voiceLanguage,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result.success) {
        addMessage("ai", result.response, false, false, !!base64Data, "システムプロンプト")

        // 音声で読み上げ（TTSが有効な場合）
        if (result.response && isTTSEnabled) {
          speakText(result.response)
        }
      } else {
        addMessage("system", `❌ チャットエラー: ${result.error}`)
        console.error("Chat error:", result.error)
      }
    } catch (error) {
      console.error("音声チャット送信エラー:", error)
      addMessage("system", `❌ 音声チャット送信エラー: ${error instanceof Error ? error.message : "不明なエラー"}`)
    } finally {
      setIsSendingChat(false)
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
      // モバイルでの画面共有エラーに対する特別なメッセージ
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
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        facingMode: facingMode, // Use the current facingMode state
      },
      audio: false,
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      return mediaStream
    } catch (error) {
      console.error("Camera access error:", error)

      // If we failed with the current facing mode, try the opposite as fallback
      if (isMobile && facingMode === "environment") {
        setFacingMode("user")
        addMessage("system", "⚠️ リアカメラへのアクセスに失敗しました。フロントカメラを試します。")

        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
          return fallbackStream
        } catch (fallbackError) {
          throw new Error("カメラアクセスに失敗しました。ブラウザの設定でカメラの許可を確認してください。")
        }
      }

      throw error
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

        if (isMobile && !capabilities.mobileScreenShare) {
          addMessage(
            "system",
            "⚠️ お使いのモバイルデバイスでは画面共有機能が制限されている可能性があります。問題が発生した場合はカメラモードをお試しください。",
          )
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
        await videoRef.current.play()
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

        const currentPromptName = VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].name
        addMessage(
          "system",
          `${getLocalizedText("periodicAnalysisStarted", interfaceLanguage).replace(
            "{frequency}",
            frequency,
          )} (${currentPromptName}モード)`,
        )
      } else {
        addMessage("system", getLocalizedText("noPeriodicAnalysis", interfaceLanguage))
      }
    } catch (error) {
      console.error("キャプチャ開始エラー:", error)
      addMessage("system", `❌ ${error instanceof Error ? error.message : "キャプチャの開始に失敗しました。"}`)

      // No automatic fallback - user must manually select camera mode
      if (captureMode === "screen") {
        addMessage("system", "💡 画面共有に問題がある場合は、カメラモードを手動で選択してください。")
      }
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
    addMessage("system", "キャプチャを停止しました。")
  }

  const captureCurrentFrame = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) {
      return null
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    if (videoRef.current.readyState < 2) {
      return null
    }

    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    if (canvas.width === 0 || canvas.height === 0) {
      return null
    }

    ctx.drawImage(videoRef.current, 0, 0)

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9)
    const base64Data = imageDataUrl.split(",")[1]

    return base64Data
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

      const promptName = VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].name
      addMessage("system", `🔍 定期解析中... (${promptName})`, true)

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
        addMessage("ai", `[${promptName}] ${result.analysis}`, true, false, true, promptName)

        if (result.analysis && isTTSEnabled) {
          speakText(result.analysis)
        }
      } else {
        addMessage("system", `❌ 定期解析エラー: ${result.error}`, true)
        console.error("Analysis error:", result.error)
      }
    } catch (error) {
      console.error("定期解析エラー:", error)
      addMessage("system", `❌ 定期解析エラー: ${error instanceof Error ? error.message : "不明なエラー"}`, true)
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

      const requestBody: any = {
        prompt: userMessage,
        systemPrompt: SYSTEM_PROMPT,
        mimeType: "image/jpeg",
      }

      if (base64Data) {
        requestBody.image = base64Data
        addMessage("system", "📸 現在の画像と一緒にメッセージを送信中...")
      } else {
        addMessage("system", "💬 テキストメッセージを送信中...")
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Language-Code": voiceLanguage,
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result.success) {
        addMessage("ai", result.response, false, false, !!base64Data, "システムプロンプト")

        if (result.response && isTTSEnabled) {
          speakText(result.response)
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

  const toggleVoiceMode = () => {
    if (!capabilities.speechRecognition) {
      addMessage("system", "❌ 音声認識がサポートされていません。")
      return
    }

    if (isVoiceMode) {
      setIsVoiceMode(false)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          console.error("Error stopping speech recognition:", error)
        }
      }
      addMessage("system", "🔇 音声入力を終了しました。")
    } else {
      setIsVoiceMode(true)
      if (recognitionRef.current && !isListening) {
        try {
          recognitionRef.current.start()
        } catch (error) {
          console.error("Error starting speech recognition:", error)
          addMessage("system", "❌ 音声認識の開始に失敗しました。ブラウザの設定を確認してください。")
        }
      }
      addMessage(
        "system",
        "🎤 音声入力を開始しました。「画面共有」「カメラ」「停止」などの音声コマンドが利用できます。",
      )
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

      if (isMobile && !capabilities.mobileScreenShare) {
        addMessage("system", "⚠️ お使いのモバイルデバイスでは画面共有機能が制限されている可能性があります。")
      }
    }
    setCaptureMode(value)
  }

  // API状態
  const [apiStatus, setApiStatus] = useState<{
    gemini: boolean
    tts: boolean
    message: string
  }>({ gemini: false, tts: false, message: "設定を確認中..." })

  // Localization function
  const getLocalizedText = (key: string, lang: string) => {
    const translations: Record<string, Record<string, string>> = {
      periodicAnalysisStarted: {
        ja: "{frequency}秒間隔で画像解析を開始します。音声コマンドも利用可能です。",
        en: "Starting image analysis at {frequency} second intervals. Voice commands are also available.",
        zh: "开始每{frequency}秒进行一次图像分析。语音命令也可用。",
        ko: "{frequency}초 간격으로 이미지 분석을 시작합니다. 음성 명령도 사용 가능합니다.",
      },
      noPeriodicAnalysis: {
        ja: "定期解析なしで開始しました。手動で解析を実行できます。",
        en: "Started without periodic analysis. You can run analysis manually.",
        zh: "已开始，无定期分析。您可以手动运行分析。",
        ko: "정기 분석 없이 시작되었습니다. 수동으로 분석을 실행할 수 있습니다.",
      },
      realTimeChat: {
        ja: "リアルタイムチャット",
        en: "Real-time Chat",
        zh: "实时聊天",
        ko: "실시간 채팅",
      },
      enterMessage: {
        ja: "メッセージを入力してください... (Enterで送信、Shift+Enterで改行)",
        en: "Enter your message... (Enter to send, Shift+Enter for new line)",
        zh: "输入您的消息... (按Enter发送，Shift+Enter换行)",
        ko: "메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)",
      },
      sending: {
        ja: "送信中...",
        en: "Sending...",
        zh: "发送中...",
        ko: "전송 중...",
      },
      processing: {
        ja: "処理中...",
        en: "Processing...",
        zh: "处理中...",
        ko: "처리 중...",
      },
      analyzeNow: {
        ja: "今すぐ解析",
        en: "Analyze Now",
        zh: "立即分析",
        ko: "지금 분석",
      },
      stop: {
        ja: "停止",
        en: "Stop",
        zh: "停止",
        ko: "중지",
      },
      start: {
        ja: "開始",
        en: "Start",
        zh: "开始",
        ko: "시작",
      },
      camera: {
        ja: "カメラ",
        en: "Camera",
        zh: "相机",
        ko: "카메라",
      },
      screenShare: {
        ja: "画面共有",
        en: "Screen Share",
        zh: "屏幕共享",
        ko: "화면 공유",
      },
      captureMode: {
        ja: "キャプチャモード",
        en: "Capture Mode",
        zh: "捕获模式",
        ko: "캡처 모드",
      },
      periodicPrompt: {
        ja: "定期解析プロンプト",
        en: "Periodic Analysis Prompt",
        zh: "定期分析提示",
        ko: "정기 분석 프롬프트",
      },
      captureFrequency: {
        ja: "キャプチャ頻度",
        en: "Capture Frequency",
        zh: "捕获频率",
        ko: "캡처 빈도",
      },
      languageSettings: {
        ja: "言語設定",
        en: "Language Settings",
        zh: "语言设置",
        ko: "언어 설정",
      },
      noPeriodicAnalysisOption: {
        ja: "定期解析なし",
        en: "No periodic analysis",
        zh: "无定期分析",
        ko: "정기 분석 없음",
      },
      seconds: {
        ja: "秒",
        en: "seconds",
        zh: "秒",
        ko: "초",
      },
    }

    return translations[key]?.[lang] || translations[key]?.["en"] || key
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側: コントロールパネル */}
        <Card className="lg:col-span-1 self-start sticky top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              AI Vision Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API状態表示 */}
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

            {/* 音声入力状態 */}
            {capabilities.speechRecognition && (
              <Alert>
                <Headphones className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      音声入力: {isVoiceMode ? "有効" : "無効"}
                      {isListening && " (聞き取り中...)"}
                    </span>
                    <Button variant={isVoiceMode ? "destructive" : "outline"} size="sm" onClick={toggleVoiceMode}>
                      {isVoiceMode ? (
                        <Mic className="w-3 h-3 text-gray-500" />
                      ) : (
                        <MicOff className="w-3 h-3 text-red-500" />
                      )}
                    </Button>
                  </div>
                  {interimTranscript && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">認識中: "{interimTranscript}"</div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* 言語設定 */}
            {capabilities.speechRecognition && (
              <div>
                <Label className="text-base font-medium flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {getLocalizedText("languageSettings", interfaceLanguage)}
                </Label>
                <div className="space-y-2 mt-2">
                  <Select
                    value={interfaceLanguage}
                    onValueChange={(value) => {
                      setInterfaceLanguage(value)
                      // Set voice language based on interface language
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
                    <SelectTrigger>
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
              </div>
            )}

            {/* 機能サポート状況 */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <div className="font-medium mb-2">機能状況:</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Camera className="w-3 h-3" />
                      <span className={capabilities.camera ? "text-green-600" : "text-red-600"}>
                        カメラ: {capabilities.camera ? "利用可能" : "利用不可"}
                        {capabilities.camera && capabilities.multipleCameras && " (複数カメラ対応)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="w-3 h-3" />
                      <span className={capabilities.screenShare ? "text-green-600" : "text-red-600"}>
                        画面共有: {capabilities.screenShare ? "利用可能" : "利用不可"}
                        {capabilities.screenShare && isMobile && !capabilities.mobileScreenShare && " (制限あり)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mic className="w-3 h-3" />
                      <span className={capabilities.speechRecognition ? "text-green-600" : "text-red-600"}>
                        音声認識: {capabilities.speechRecognition ? "利用可能" : "利用不可"}
                      </span>
                    </div>
                    {isMobile && (
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-3 h-3" />
                        <span className="text-blue-600">モバイルデバイス検出済み</span>
                      </div>
                    )}
                  </div>
                  {capabilities.speechRecognition && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                      💡 音声コマンド: 「画面共有」「カメラ」「停止」「音声入力終了」
                      {capabilities.multipleCameras && "「カメラ切替」"}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {/* キャプチャモード選択 */}
            <div>
              <Label className="text-base font-medium">{getLocalizedText("captureMode", interfaceLanguage)}</Label>
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
                    {getLocalizedText("camera", interfaceLanguage)}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="screen" id="screen" disabled={!capabilities.screenShare} />
                  <Label
                    htmlFor="screen"
                    className={`flex items-center gap-2 ${!capabilities.screenShare ? "opacity-50" : ""}`}
                  >
                    <Monitor className="w-4 h-4" />
                    {getLocalizedText("screenShare", interfaceLanguage)}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* カメラ切り替えボタン (モバイルかつ複数カメラがある場合のみ表示) */}
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

            {/* 画像解析プロンプト選択 */}
            <div>
              <Label className="text-base font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                画像解析プロンプト
              </Label>
              <Select
                value={visualAnalysisType}
                onValueChange={(value: keyof typeof VISUAL_ANALYSIS_PROMPTS) => setVisualAnalysisType(value)}
                disabled={isCapturing}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VISUAL_ANALYSIS_PROMPTS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <div>
                          <div className="font-medium">{config.name}</div>
                          <div className="text-xs text-gray-500">{config.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 選択されたプロンプトの説明 */}
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                <div className="flex items-center gap-2 font-medium text-blue-800 mb-1">
                  {VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].icon}
                  {VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].name}
                </div>
                <div className="text-blue-700 text-xs mb-2">
                  {VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].description}
                </div>
                {visualAnalysisType !== "custom" && (
                  <div className="text-blue-600 text-xs bg-white p-2 rounded border">
                    {VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].prompt}
                  </div>
                )}
              </div>
            </div>

            {/* カスタムプロンプト入力 */}
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

            {/* キャプチャ頻度 */}
            <div>
              <Label className="text-base font-medium">{getLocalizedText("captureFrequency", interfaceLanguage)}</Label>
              <Select value={frequency} onValueChange={setFrequency} disabled={isCapturing}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{getLocalizedText("noPeriodicAnalysisOption", interfaceLanguage)}</SelectItem>
                  <SelectItem value="0.5">0.5 {getLocalizedText("seconds", interfaceLanguage)}</SelectItem>
                  <SelectItem value="1">1 {getLocalizedText("seconds", interfaceLanguage)}</SelectItem>
                  <SelectItem value="3">3 {getLocalizedText("seconds", interfaceLanguage)}</SelectItem>
                  <SelectItem value="5">5 {getLocalizedText("seconds", interfaceLanguage)}</SelectItem>
                  <SelectItem value="10">10 {getLocalizedText("seconds", interfaceLanguage)}</SelectItem>
                  <SelectItem value="20">20 {getLocalizedText("seconds", interfaceLanguage)}</SelectItem>
                  <SelectItem value="30">30 {getLocalizedText("seconds", interfaceLanguage)}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* コントロールボタン */}
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
                      {getLocalizedText("stop", interfaceLanguage)}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      {getLocalizedText("start", interfaceLanguage)}
                    </>
                  )}
                </Button>

                <Button onClick={toggleTTS} variant="outline" size="lg">
                  {isTTSEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              </div>

              {isCapturing && Number.parseFloat(frequency) >= 0 && (
                <Button onClick={manualCapture} disabled={isProcessing} variant="outline" className="w-full">
                  {isProcessing
                    ? getLocalizedText("processing", interfaceLanguage)
                    : getLocalizedText("analyzeNow", interfaceLanguage)}
                </Button>
              )}
            </div>

            {/* ビデオプレビュー */}
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: "200px" }}
                muted
                playsInline
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
              {isVoiceMode && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  音声入力
                </div>
              )}
              {isCapturing && (
                <div className="absolute bottom-2 left-2 bg-purple-500 text-white px-2 py-1 rounded text-xs">
                  {VISUAL_ANALYSIS_PROMPTS[visualAnalysisType].name}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右側: チャット画面 - 高さを画面いっぱいに拡張 */}
        <Card className="lg:col-span-2 flex flex-col" style={{ minHeight: "calc(100vh - 2rem)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              顧客サポートチャット
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-grow p-4 pt-0">
            {/* メッセージ表示エリア - 高さを自動調整 */}
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
                            <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded">音声入力</span>
                          )}
                          {message.isPeriodicAnalysis && (
                            <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded">定期解析</span>
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

            {/* チャット入力エリア - 下部に固定 */}
            <div className="border-t pt-4 mt-auto">
              <Label htmlFor="chatMessage" className="text-sm font-medium flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4" />
                {getLocalizedText("realTimeChat", interfaceLanguage)}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Textarea
                    id="chatMessage"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder={getLocalizedText("enterMessage", interfaceLanguage)}
                    className="flex-1 min-h-[60px] max-h-[120px] pr-10"
                    disabled={isSendingChat}
                  />
                  {capabilities.speechRecognition && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleListening}
                      disabled={!capabilities.speechRecognition}
                      className="absolute right-2 bottom-2 h-8 w-8 p-0"
                    >
                      {isListening ? (
                        <Mic className="w-4 h-4 text-gray-500" />
                      ) : (
                        <MicOff className="w-4 h-4 text-red-500" />
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
                    getLocalizedText("sending", interfaceLanguage)
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
  )
}
