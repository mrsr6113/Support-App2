"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mic, MicOff, Camera, Monitor, Play, Square } from "lucide-react"

interface Message {
  id: string
  text: string
  sender: "user" | "ai"
  timestamp: Date
}

export default function Home() {
  const [inputType, setInputType] = useState<"camera" | "screen">("camera")
  const [prompt, setPrompt] = useState("")
  const [captureFrequency, setCaptureFrequency] = useState("10")
  const [isCapturing, setIsCapturing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isListening, setIsListening] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // 音声認識の設定
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ja-JP"

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("")
        setPrompt(transcript)
      }

      if (isListening) {
        recognition.start()
      } else {
        recognition.stop()
      }

      return () => recognition.stop()
    }
  }, [isListening])

  // カメラ/画面共有の開始
  const startCapture = async () => {
    try {
      let mediaStream: MediaStream

      if (inputType === "camera") {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        })
      } else {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        })
      }

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }

      setIsCapturing(true)

      // 定期的なキャプチャを開始
      intervalRef.current = setInterval(() => {
        captureAndAnalyze()
      }, Number.parseInt(captureFrequency) * 1000)
    } catch (error) {
      console.error("メディアアクセスエラー:", error)
      addMessage("カメラまたは画面共有へのアクセスに失敗しました。", "ai")
    }
  }

  // キャプチャ停止
  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setIsCapturing(false)
  }

  // 画像をキャプチャして分析
  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || !prompt.trim()) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // ビデオフレームをキャンバスに描画
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)

    // Base64エンコード
    const imageData = canvas.toDataURL("image/jpeg", 0.8)

    try {
      // Gemini APIで画像分析
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageData,
          prompt: prompt,
        }),
      })

      const result = await response.json()

      if (result.success) {
        addMessage(result.analysis, "ai")

        // TTS APIで音声読み上げ
        await speakText(result.analysis)
      } else {
        addMessage("画像分析に失敗しました。", "ai")
      }
    } catch (error) {
      console.error("分析エラー:", error)
      addMessage("分析中にエラーが発生しました。", "ai")
    }
  }

  // テキストを音声で読み上げ
  const speakText = async (text: string) => {
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        audio.play()
      }
    } catch (error) {
      console.error("音声合成エラー:", error)
    }
  }

  // メッセージを追加
  const addMessage = (text: string, sender: "user" | "ai") => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, newMessage])
  }

  // 手動でメッセージ送信
  const sendMessage = () => {
    if (prompt.trim()) {
      addMessage(prompt, "user")
      if (isCapturing) {
        captureAndAnalyze()
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-center">AI Support</h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 設定パネル */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 入力タイプ選択 */}
                <div>
                  <Label className="text-sm font-medium">入力タイプ</Label>
                  <RadioGroup value={inputType} onValueChange={(value: "camera" | "screen") => setInputType(value)}>
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
                </div>

                {/* キャプチャ頻度 */}
                <div>
                  <Label className="text-sm font-medium">キャプチャ頻度</Label>
                  <Select value={captureFrequency} onValueChange={setCaptureFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10秒</SelectItem>
                      <SelectItem value="20">20秒</SelectItem>
                      <SelectItem value="30">30秒</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* プロンプト入力 */}
                <div>
                  <Label className="text-sm font-medium">プロンプト</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="画像に対する質問や指示を入力してください..."
                    className="min-h-[100px]"
                  />
                </div>

                {/* 音声入力ボタン */}
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  onClick={() => setIsListening(!isListening)}
                  className="w-full"
                >
                  {isListening ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                  {isListening ? "音声入力停止" : "音声入力開始"}
                </Button>

                {/* 開始/停止ボタン */}
                <Button
                  onClick={isCapturing ? stopCapture : startCapture}
                  disabled={!prompt.trim()}
                  className="w-full"
                  variant={isCapturing ? "destructive" : "default"}
                >
                  {isCapturing ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {isCapturing ? "停止" : "開始"}
                </Button>

                {/* 手動送信ボタン */}
                <Button onClick={sendMessage} disabled={!prompt.trim()} variant="outline" className="w-full">
                  手動で分析実行
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* メインコンテンツ */}
          <div className="lg:col-span-2 space-y-6">
            {/* チャットメッセージエリア */}
            <Card>
              <CardHeader>
                <CardTitle>チャット履歴</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.sender === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          <p className="text-sm">{message.text}</p>
                          <p className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 画像エリア（カメラ/画面共有） */}
            <Card>
              <CardHeader>
                <CardTitle>{inputType === "camera" ? "カメラ映像" : "画面共有"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay muted className="w-full h-64 object-cover" />
                  {!stream && (
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <p>{inputType === "camera" ? "カメラ" : "画面共有"}を開始してください</p>
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
