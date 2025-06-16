import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key for admin operations
export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Database types
export interface RAGDocument {
  id: string
  title: string
  content: string
  category: string
  tags?: string[]
  created_at: string
  updated_at: string
  is_active: boolean
}

export interface SystemPrompt {
  id: string
  name: string
  prompt: string
  description?: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface VisualAnalysisPrompt {
  id: string
  name: string
  prompt: string
  description?: string
  icon_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChatSession {
  id: string
  session_id: string
  messages: any[]
  created_at: string
  updated_at: string
}
