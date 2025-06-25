import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Singleton pattern for client-side Supabase client
let supabaseInstance: ReturnType<typeof createClient> | null = null

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return supabaseInstance
})()

// Singleton pattern for server-side admin client
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null

export const supabaseAdmin = (() => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return supabaseAdminInstance
})()

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
