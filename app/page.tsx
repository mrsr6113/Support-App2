"use client"

import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function Home() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState("")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768) // Adjust breakpoint as needed
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  const sendMessage = () => {
    if (inputValue.trim() !== "") {
      setMessages([...messages, { text: inputValue, sender: "user" }])
      setInputValue("")
    }
  }

  const getVideoAreaClasses = () => {
    return isMobile
      ? "w-full h-64 bg-gray-200" // Mobile styles
      : "w-96 h-96 bg-gray-200" // PC styles
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-100 p-4">
        <h1 className="text-xl font-bold">AI Support</h1>
      </header>

      <main className="flex-1 flex flex-col md:flex-row">
        {/* メッセージエリア（チャット履歴） */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={message.sender === "user" ? "text-right" : "text-left"}>
                  <span className="inline-block p-2 rounded-lg bg-blue-100">{message.text}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* 画像エリア（カメラ映像） */}
        <div className={getVideoAreaClasses()}>
          {/* カメラ映像表示 */}
          <p className="text-center">Camera View</p>
        </div>
      </main>

      {/* メッセージ入力エリア */}
      <div className="p-4 border-t bg-white">
        <div className="flex">
          <input
            type="text"
            className="flex-1 border rounded-l-md p-2"
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button className="bg-blue-500 text-white rounded-r-md p-2 hover:bg-blue-700" onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
