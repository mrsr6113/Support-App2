"use client"

import { useState, useEffect } from "react"
import type { RAGDocument, SystemPrompt, VisualAnalysisPrompt } from "@/lib/supabase"

export function useSupabaseRAGDocuments() {
  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/supabase/rag-documents")
      const result = await response.json()

      if (result.success) {
        setDocuments(result.documents || [])
        setError(null)

        // Show message if tables aren't initialized
        if (result.message) {
          console.warn(result.message)
        }
      } else {
        setError(result.error)
        setDocuments([])
      }
    } catch (err) {
      setError("Failed to fetch RAG documents")
      setDocuments([])
      console.error("RAG documents fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  const addDocument = async (title: string, content: string, category: string, tags?: string[]) => {
    try {
      const response = await fetch("/api/supabase/rag-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category, tags }),
      })

      const result = await response.json()
      if (result.success) {
        await fetchDocuments() // Refresh the list
        return result.document
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      console.error("Add document error:", err)
      throw err
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/supabase/rag-documents?id=${id}`, {
        method: "DELETE",
      })

      const result = await response.json()
      if (result.success) {
        await fetchDocuments() // Refresh the list
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      console.error("Delete document error:", err)
      throw err
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  return {
    documents,
    loading,
    error,
    addDocument,
    deleteDocument,
    refetch: fetchDocuments,
  }
}

export function useSupabaseSystemPrompts() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/supabase/system-prompts")
      const result = await response.json()

      if (result.success) {
        setPrompts(result.prompts || [])
        setError(null)

        // Show message if tables aren't initialized
        if (result.message) {
          console.warn(result.message)
        }
      } else {
        setError(result.error)
        setPrompts([])
      }
    } catch (err) {
      setError("Failed to fetch system prompts")
      setPrompts([])
      console.error("System prompts fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  const addPrompt = async (name: string, prompt: string, description?: string, isDefault?: boolean) => {
    try {
      const response = await fetch("/api/supabase/system-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, description, isDefault }),
      })

      const result = await response.json()
      if (result.success) {
        await fetchPrompts() // Refresh the list
        return result.prompt
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      console.error("Add prompt error:", err)
      throw err
    }
  }

  useEffect(() => {
    fetchPrompts()
  }, [])

  return {
    prompts,
    loading,
    error,
    addPrompt,
    refetch: fetchPrompts,
  }
}

export function useSupabaseVisualPrompts() {
  const [prompts, setPrompts] = useState<VisualAnalysisPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/supabase/visual-prompts")
      const result = await response.json()

      if (result.success) {
        setPrompts(result.prompts || [])
        setError(null)

        // Show message if tables aren't initialized
        if (result.message) {
          console.warn(result.message)
        }
      } else {
        setError(result.error)
        setPrompts([])
      }
    } catch (err) {
      setError("Failed to fetch visual analysis prompts")
      setPrompts([])
      console.error("Visual prompts fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrompts()
  }, [])

  return {
    prompts,
    loading,
    error,
    refetch: fetchPrompts,
  }
}
