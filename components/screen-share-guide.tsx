import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Monitor, Camera, Info, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

interface ScreenShareGuideProps {
  capabilities: {
    camera: boolean
    screenShare: boolean
    speechRecognition: boolean
  }
  currentMode: "camera" | "screen"
}

export function ScreenShareGuide({ capabilities, currentMode }: ScreenShareGuideProps) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="w-4 h-4" />
          使用方法ガイド
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-3">
          {/* 画面共有の説明 */}
          <div className="flex items-start gap-2">
            <Monitor className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                画面共有
                {capabilities.screenShare ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-500" />
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {capabilities.screenShare ? (
                  <>
                    開始ボタンを押すとブラウザのポップアップが表示されます。
                    <br />
                    共有したい画面またはウィンドウを選択して「共有」をクリックしてください。
                  </>
                ) : (
                  "この環境では画面共有が制限されています。"
                )}
              </div>
            </div>
          </div>

          {/* カメラの説明 */}
          <div className="flex items-start gap-2">
            <Camera className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                カメラ
                {capabilities.camera ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-red-500" />
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {capabilities.camera
                  ? "ブラウザの許可ダイアログで「許可」を選択してください。"
                  : "カメラアクセスが利用できません。"}
              </div>
            </div>
          </div>

          {/* 現在のモードに応じた注意事項 */}
          {currentMode === "screen" && capabilities.screenShare && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                画面共有が拒否された場合、自動的にカメラモードに切り替わります。
              </AlertDescription>
            </Alert>
          )}
        </div>

        {!capabilities.screenShare && !capabilities.camera && (
          <Alert>
            <AlertDescription className="text-xs">
              メディア機能が制限されています。ブラウザの設定やセキュリティポリシーを確認してください。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
