import { Mic, MicOff, Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface VoiceStatusIndicatorProps {
  isListening: boolean
  isSpeaking: boolean
  isSupported: boolean
}

export function VoiceStatusIndicator({ isListening, isSpeaking, isSupported }: VoiceStatusIndicatorProps) {
  if (!isSupported) {
    return (
      <Badge variant="secondary" className="text-xs">
        <MicOff className="w-3 h-3 mr-1" />
        音声未対応
      </Badge>
    )
  }

  if (isListening) {
    return (
      <Badge variant="destructive" className="text-xs animate-pulse">
        <Mic className="w-3 h-3 mr-1" />
        音声入力中
      </Badge>
    )
  }

  if (isSpeaking) {
    return (
      <Badge variant="default" className="text-xs">
        <Volume2 className="w-3 h-3 mr-1" />
        音声出力中
      </Badge>
    )
  }

  return null
}
