"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
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
  Send,
  Brain,
  Zap,
  AlertTriangle,
  Info,
  RefreshCw,
  Eye,
  MessageSquare,
  User,
  Bot,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/hooks/use-toast"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { VoiceStatusIndicator } from "@/components/voice-status-indicator"
import { ErrorBoundary } from "@/components/error-boundary"

interface Message {
  id: string
  type: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  isAudio?: boolean
}

interface CaptureSettings {
  frequency: number
  quality: "low" | "medium" | "high"
  autoCapture: boolean
}

interface TTSSettings {
  enabled: boolean
  voice: string
  speed: number
  volume: number
  language: string
}

interface DebugInfo {
  apiCalls: number
  errors: number
  lastError?: string
  performance: {
    avgResponseTime: number
    totalRequests: number
  }
}

function AIVisionChatPage() {
  // Core state
  const [inputType, setInputType] = useState<"camera" | "screen">("camera")
  const [prompt, setPrompt] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Settings state
  const [captureSettings, setCaptureSettings] = useState<CaptureSettings>({
    frequency: 10,
    quality: "medium",
    autoCapture: true,
  })

  const [ttsSettings, setTTSSettings] = useState<TTSSettings>({
    enabled: true,
    voice: "ja-JP-Standard-A",
    speed: 1.0,
    volume: 0.8,
    language: "ja-JP",
  })

  // Debug state
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    apiCalls: 0,
    errors: 0,
    performance: {
      avgResponseTime: 0,
      totalRequests: 0,
    },
  })

  const [showDebug, setShowDebug] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Speech recognition
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: speechSupported,
    error: speechError,
  } = useSpeechRecognition()

  // Audio state
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Add message helper
  const addMessage = useCallback((message: Omit<Message, "id" | "timestamp">) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
    return newMessage
  }, [])

  // Update debug info
  const updateDebugInfo = useCallback((update: Partial<DebugInfo>) => {
    setDebugInfo((prev) => ({ ...prev, ...update }))
  }, [])

  // Start media capture
  const startCapture = async () => {
    try {
      let stream: MediaStream

      if (inputType === "camera") {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        })
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: false,
        })
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsCapturing(true)

        if (captureSettings.autoCapture) {
          startAutoCapture()
        }

        addMessage({
          type: "system",
          content: `${inputType === "camera" ? "カメラ" : "画面共有"}を開始しました`,
        })
      }
    } catch (error) {
      console.error("Media capture error:", error)
      const errorMessage = error instanceof Error ? error.message : "不明なエラー"
      addMessage({
        type: "system",
        content: `メディアキャプチャエラー: ${errorMessage}`,
      })
      updateDebugInfo({
        errors: debugInfo.errors + 1,
        lastError: errorMessage,
      })
      toast({
        title: "キャプチャエラー",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Stop media capture
  const stopCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsCapturing(false)
    addMessage({
      type: "system",
      content: "キャプチャを停止しました",
    })
  }

  // Start auto capture
  const startAutoCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      if (prompt.trim()) {
        captureAndAnalyze()
      }
    }, captureSettings.frequency * 1000)
  }

  // Capture frame
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return null

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const quality = captureSettings.quality === "high" ? 0.9 : captureSettings.quality === "medium" ? 0.7 : 0.5
    return canvas.toDataURL("image/jpeg", quality)
  }

  // Analyze image
  const analyzeImage = async (imageData: string, userPrompt: string) => {
    const startTime = Date.now()

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          prompt: userPrompt,
          settings: {
            language: ttsSettings.language,
            includeDetails: true,
          },
        }),
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      // Update performance metrics
      const newTotalRequests = debugInfo.performance.totalRequests + 1
      const newAvgResponseTime =
        (debugInfo.performance.avgResponseTime * debugInfo.performance.totalRequests + responseTime) / newTotalRequests

      updateDebugInfo({
        apiCalls: debugInfo.apiCalls + 1,
        performance: {
          avgResponseTime: newAvgResponseTime,
          totalRequests: newTotalRequests,
        },
      })

      return data.analysis
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "分析エラー"
      updateDebugInfo({
        errors: debugInfo.errors + 1,
        lastError: errorMessage,
      })
      throw error
    }
  }

  // Text-to-Speech
  const speakText = async (text: string) => {
    if (!isTTSEnabled || !text.trim()) return

    try {
      setIsPlayingAudio(true)

      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Language-Code": ttsSettings.language,
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "TTS エラー")
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.volume = ttsSettings.volume
        audioRef.current.playbackRate = ttsSettings.speed
        await audioRef.current.play()
      }
    } catch (error) {
      console.error("TTS error:", error)
      const errorMessage = error instanceof Error ? error.message : "音声合成エラー"
      addMessage({
        type: "system",
        content: `音声読み上げに失敗しました: ${errorMessage}`,
      })
      toast({
        title: "音声エラー",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsPlayingAudio(false)
    }
  }

  // Capture and analyze
  const captureAndAnalyze = async () => {
    if (!prompt.trim()) {
      toast({
        title: "プロンプトが必要です",
        description: "分析内容を入力してください",
        variant: "destructive",
      })
      return
    }

    const imageData = captureFrame()
    if (!imageData) {
      toast({
        title: "キャプチャエラー",
        description: "画像をキャプチャできませんでした",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      addMessage({
        type: "user",
        content: prompt,
      })

      const analysis = await analyzeImage(imageData, prompt)

      addMessage({
        type: "assistant",
        content: analysis,
      })

      if (isTTSEnabled) {
        await speakText(analysis)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "分析に失敗しました"
      addMessage({
        type: "system",
        content: `エラー: ${errorMessage}`,
      })
      toast({
        title: "分析エラー",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle speech recognition
  useEffect(() => {
    if (transcript) {
      setPrompt(transcript)
    }
  }, [transcript])

  // Handle audio end
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      const handleEnded = () => setIsPlayingAudio(false)
      audio.addEventListener("ended", handleEnded)
      return () => audio.removeEventListener("ended", handleEnded)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture()
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Eye className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Universal AI Vision Chat</h1>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Voice + TTS
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
                <Info className="h-4 w-4" />
                Debug
              </Button>
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                    設定
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>設定</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="capture" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="capture">キャプチャ</TabsTrigger>
                      <TabsTrigger value="audio">音声</TabsTrigger>
                      <TabsTrigger value="advanced">詳細</TabsTrigger>
                    </TabsList>

                    <TabsContent value="capture" className="space-y-4">
                      <div className="space-y-3">
                        <Label>キャプチャ頻度 (秒)</Label>
                        <Select
                          value={captureSettings.frequency.toString()}
                          onValueChange={(value) =>
                            setCaptureSettings((prev) => ({ ...prev, frequency: Number.parseInt(value) }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5秒</SelectItem>
                            <SelectItem value="10">10秒</SelectItem>
                            <SelectItem value="20">20秒</SelectItem>
                            <SelectItem value="30">30秒</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label>画質</Label>
                        <RadioGroup
                          value={captureSettings.quality}
                          onValueChange={(value: "low" | "medium" | "high") =>
                            setCaptureSettings((prev) => ({ ...prev, quality: value }))
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="low" id="low" />
                            <Label htmlFor="low">低画質 (高速)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="medium" id="medium" />
                            <Label htmlFor="medium">中画質 (推奨)</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="high" id="high" />
                            <Label htmlFor="high">高画質 (低速)</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-capture">自動キャプチャ</Label>
                        <Switch
                          id="auto-capture"
                          checked={captureSettings.autoCapture}
                          onCheckedChange={(checked) =>
                            setCaptureSettings((prev) => ({ ...prev, autoCapture: checked }))
                          }
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="audio" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="tts-enabled">音声読み上げ</Label>
                        <Switch
                          id="tts-enabled"
                          checked={ttsSettings.enabled}
                          onCheckedChange={(checked) => setTTSSettings((prev) => ({ ...prev, enabled: checked }))}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>言語</Label>
                        <Select
                          value={ttsSettings.language}
                          onValueChange={(value) => setTTSSettings((prev) => ({ ...prev, language: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ja-JP">日本語</SelectItem>
                            <SelectItem value="en-US">English (US)</SelectItem>
                            <SelectItem value="en-GB">English (UK)</SelectItem>
                            <SelectItem value="zh-CN">中文</SelectItem>
                            <SelectItem value="ko-KR">한국어</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label>読み上げ速度: {ttsSettings.speed}x</Label>
                        <Slider
                          value={[ttsSettings.speed]}
                          onValueChange={([value]) => setTTSSettings((prev) => ({ ...prev, speed: value }))}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>音量: {Math.round(ttsSettings.volume * 100)}%</Label>
                        <Slider
                          value={[ttsSettings.volume]}
                          onValueChange={([value]) => setTTSSettings((prev) => ({ ...prev, volume: value }))}
                          min={0}
                          max={1}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4">
                      <div className="space-y-3">
                        <Label>デバッグ情報</Label>
                        <div className="rounded-lg bg-slate-100 p-3 text-sm">
                          <div>API呼び出し: {debugInfo.apiCalls}</div>
                          <div>エラー数: {debugInfo.errors}</div>
                          <div>平均応答時間: {Math.round(debugInfo.performance.avgResponseTime)}ms</div>
                          {debugInfo.lastError && <div className="text-red-600">最新エラー: {debugInfo.lastError}</div>}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() =>
                          setDebugInfo({
                            apiCalls: 0,
                            errors: 0,
                            performance: { avgResponseTime: 0, totalRequests: 0 },
                          })
                        }
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        統計をリセット
                      </Button>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Debug Panel */}
          {showDebug && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">API呼び出し</div>
                    <div className="text-2xl font-bold text-blue-600">{debugInfo.apiCalls}</div>
                  </div>
                  <div>
                    <div className="font-medium">エラー数</div>
                    <div className="text-2xl font-bold text-red-600">{debugInfo.errors}</div>
                  </div>
                  <div>
                    <div className="font-medium">平均応答時間</div>
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(debugInfo.performance.avgResponseTime)}ms
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">成功率</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {debugInfo.performance.totalRequests > 0
                        ? Math.round(
                            ((debugInfo.performance.totalRequests - debugInfo.errors) /
                              debugInfo.performance.totalRequests) *
                              100,
                          )
                        : 100}
                      %
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Controls */}
            <div className="space-y-4">
              {/* Input Type Selection */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <RadioGroup value={inputType} onValueChange={(value: "camera" | "screen") => setInputType(value)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="camera" id="camera" />
                        <Label htmlFor="camera" className="flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          カメラ
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="screen" id="screen" />
                        <Label htmlFor="screen" className="flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          画面共有
                        </Label>
                      </div>
                    </RadioGroup>

                    <Button onClick={isCapturing ? stopCapture : startCapture} className="w-full" size="lg">
                      {isCapturing ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          停止
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          開始
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Voice Status */}
              <VoiceStatusIndicator
                isListening={isListening}
                isSupported={speechSupported}
                error={speechError}
                isPlayingAudio={isPlayingAudio}
              />

              {/* Processing Status */}
              {isProcessing && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <div>
                        <div className="font-medium">AI分析中...</div>
                        <div className="text-sm text-gray-600">画像を解析しています</div>
                      </div>
                    </div>
                    <Progress value={undefined} className="mt-3" />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Center Column - Video and Chat */}
            <div className="lg:col-span-2 space-y-4">
              {/* Video Display - パソコンで大きく表示 */}
              <Card>
                <CardContent className="p-4">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded-lg bg-gray-100 
                        aspect-video md:aspect-[16/10] md:min-h-[400px] lg:min-h-[500px]"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {!isCapturing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 rounded-lg">
                        <Camera className="h-16 w-16 text-gray-400 mb-4" />
                        <p className="text-gray-600 text-center">
                          開始ボタンを押して{inputType === "camera" ? "カメラ" : "画面共有"}を開始
                        </p>
                        <p className="text-sm text-gray-500 mt-2">AIが自動的に関連文章を検索します</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Chat Messages */}
              <Card>
                <CardContent className="p-4">
                  <ScrollArea className="h-64 w-full">
                    <div className="space-y-3">
                      {messages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p>メッセージはここに表示されます</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div className="flex gap-2 max-w-[80%]">
                              {message.type !== "user" && (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {message.type === "assistant" ? (
                                    <Bot className="w-4 h-4" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4" />
                                  )}
                                </div>
                              )}
                              <div
                                className={`rounded-lg px-3 py-2 ${
                                  message.type === "user"
                                    ? "bg-blue-600 text-white"
                                    : message.type === "assistant"
                                      ? "bg-gray-100 text-gray-900"
                                      : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                <div className="text-sm">{message.content}</div>
                                <div className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleTimeString()}</div>
                              </div>
                              {message.type === "user" && (
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Input Area - 改善されたレイアウト */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="メッセージを入力（任意）..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="flex-1 min-h-[60px] resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            captureAndAnalyze()
                          }
                        }}
                      />
                      <Button
                        onClick={captureAndAnalyze}
                        disabled={isProcessing || !isCapturing}
                        size="lg"
                        className="px-4"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* 音声関連ボタンを横並びで配置 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={isListening ? stopListening : startListening}
                          disabled={!speechSupported}
                          className="flex items-center gap-2 bg-transparent"
                        >
                          {isListening ? (
                            <>
                              <MicOff className="h-4 w-4" />
                              停止
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4" />
                              音声入力
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                          className="flex items-center gap-2"
                        >
                          {isTTSEnabled ? (
                            <>
                              <Volume2 className="h-4 w-4" />
                              音声ON
                            </>
                          ) : (
                            <>
                              <VolumeX className="h-4 w-4" />
                              音声OFF
                            </>
                          )}
                        </Button>
                      </div>

                      {isProcessing && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Brain className="h-4 w-4 animate-pulse" />
                          AI分析中...
                        </div>
                      )}
                    </div>

                    {/* Speech recognition feedback */}
                    {speechError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{speechError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Hidden audio element for TTS */}
        <audio ref={audioRef} className="hidden" />
      </div>
    </ErrorBoundary>
  )
}

export default AIVisionChatPage
