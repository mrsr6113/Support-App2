"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Coffee, AlertTriangle, CheckCircle, Wrench, Lightbulb, Phone, Search, Camera, Upload } from "lucide-react"

interface DiagnosisResult {
  problem: string
  urgency: "low" | "medium" | "high"
  solution: string[]
  prevention: string[]
  nextSteps: string[]
}

export function CoffeeMakerDemo() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const demoImages = [
    {
      id: "manual",
      src: "/coffee-maker-manual.png",
      title: "トラブルシューティング表",
      description: "マニュアルのインジケーター説明",
    },
    {
      id: "panel",
      src: "/coffee-maker-panel.png",
      title: "コントロールパネル",
      description: "実際のコーヒーメーカー",
    },
  ]

  const simulateDiagnosis = async (imageId: string) => {
    setIsAnalyzing(true)

    // Simulate AI analysis delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    let result: DiagnosisResult

    if (imageId === "panel") {
      result = {
        problem: "抽出ユニットのふたが開いています（赤いインジケーター点滅を検出）",
        urgency: "high",
        solution: [
          "⚠️ まず電源を切ってください",
          "🔧 抽出ユニットのふたを確認してください",
          "🔒 ふたをしっかりと閉めてください",
          "✅ ロックが正しくかかっているか確認してください",
          "🔌 電源を入れ直してください",
        ],
        prevention: [
          "定期的にふたのロック機構を点検する",
          "清掃時は必ずふたを正しく閉める",
          "異物がロック部分に挟まっていないか確認する",
        ],
        nextSteps: [
          "上記手順で解決しない場合は、ロック機構の故障が考えられます",
          "取扱説明書の詳細なトラブルシューティングを参照してください",
          "それでも解決しない場合は、カスタマーサポートにお問い合わせください",
        ],
      }
    } else {
      result = {
        problem: "マニュアル画像を分析中 - 複数のトラブルシューティングパターンを確認",
        urgency: "low",
        solution: [
          "📖 マニュアルの表示パターンを参照してください",
          "🔍 現在のコーヒーメーカーの状態と照合してください",
          "📷 実際のコントロールパネルの写真を撮影してください",
        ],
        prevention: ["定期的なメンテナンススケジュールを作成する", "マニュアルを手の届く場所に保管する"],
        nextSteps: [
          "実際のコーヒーメーカーの画像をアップロードしてください",
          "具体的な症状について詳しく教えてください",
        ],
      }
    }

    setDiagnosis(result)
    setIsAnalyzing(false)
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "secondary"
    }
  }

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "high":
        return <AlertTriangle className="w-4 h-4" />
      case "medium":
        return <AlertTriangle className="w-4 h-4" />
      case "low":
        return <CheckCircle className="w-4 h-4" />
      default:
        return <CheckCircle className="w-4 h-4" />
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee className="w-6 h-6" />
            AI コーヒーメーカー トラブルシューティング システム
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            コーヒーメーカーの画像をアップロードまたは選択して、AIによる自動診断を受けてください。
            インジケーターライトのパターンを分析し、具体的な解決策を提供します。
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              画像選択・アップロード
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {demoImages.map((image) => (
                <div
                  key={image.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedImage === image.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedImage(image.id)}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={image.src || "/placeholder.svg"}
                      alt={image.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div>
                      <h3 className="font-medium">{image.title}</h3>
                      <p className="text-sm text-gray-500">{image.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <Button variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                独自の画像をアップロード
              </Button>
            </div>

            <Button
              onClick={() => selectedImage && simulateDiagnosis(selectedImage)}
              disabled={!selectedImage || isAnalyzing}
              className="w-full"
            >
              <Search className="w-4 h-4 mr-2" />
              {isAnalyzing ? "分析中..." : "AI診断を開始"}
            </Button>
          </CardContent>
        </Card>

        {/* Diagnosis Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              診断結果
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAnalyzing && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2">AI分析中...</span>
              </div>
            )}

            {diagnosis && !isAnalyzing && (
              <div className="space-y-6">
                {/* Problem Identification */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4" />
                    <h3 className="font-semibold">問題の特定</h3>
                  </div>
                  <p className="text-sm bg-gray-50 p-3 rounded">{diagnosis.problem}</p>
                </div>

                {/* Urgency */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getUrgencyIcon(diagnosis.urgency)}
                    <h3 className="font-semibold">緊急度</h3>
                  </div>
                  <Badge variant={getUrgencyColor(diagnosis.urgency) as any}>
                    {diagnosis.urgency === "high" ? "高" : diagnosis.urgency === "medium" ? "中" : "低"}
                  </Badge>
                </div>

                {/* Solution Steps */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4" />
                    <h3 className="font-semibold">解決手順</h3>
                  </div>
                  <ol className="space-y-2">
                    {diagnosis.solution.map((step, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Prevention */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4" />
                    <h3 className="font-semibold">予防策</h3>
                  </div>
                  <ul className="space-y-1">
                    {diagnosis.prevention.map((tip, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-yellow-500 mt-1">💡</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Next Steps */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4" />
                    <h3 className="font-semibold">追加サポート</h3>
                  </div>
                  <ul className="space-y-1">
                    {diagnosis.nextSteps.map((step, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-blue-500 mt-1">📞</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {!diagnosis && !isAnalyzing && (
              <div className="text-center py-8 text-gray-500">画像を選択して診断を開始してください</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>システム機能</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <Camera className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <h3 className="font-semibold mb-1">画像認識</h3>
              <p className="text-sm text-gray-600">インジケーターライトの色と点滅パターンを正確に検出</p>
            </div>
            <div className="text-center p-4">
              <Search className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <h3 className="font-semibold mb-1">問題診断</h3>
              <p className="text-sm text-gray-600">マニュアルベースの知識で具体的な問題を特定</p>
            </div>
            <div className="text-center p-4">
              <Wrench className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <h3 className="font-semibold mb-1">解決提案</h3>
              <p className="text-sm text-gray-600">段階的で分かりやすい解決手順を提供</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Notice */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>安全に関する重要な注意:</strong>
          電気製品の修理作業を行う前は必ず電源を切り、プラグを抜いてください。
          水回りの作業では感電に十分注意してください。 不明な点がある場合は、専門業者にご相談ください。
        </AlertDescription>
      </Alert>
    </div>
  )
}
