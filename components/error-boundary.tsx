"use client"

import React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">アプリケーションエラーが発生しました</h3>
                    <p className="text-sm mt-1">{this.state.error?.message || "予期しないエラーが発生しました"}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={this.resetError} size="sm" variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      再試行
                    </Button>
                    <Button onClick={() => window.location.reload()} size="sm">
                      ページを再読み込み
                    </Button>
                  </div>

                  {process.env.NODE_ENV === "development" && this.state.error && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium">開発者向け詳細情報</summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">{this.state.error.stack}</pre>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
