import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a single instance to prevent multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createClient> | null = null
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  }
  return supabaseInstance
})()

// Server-side client with service role key for admin operations
export const supabaseAdmin = (() => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }
  return supabaseAdminInstance
})()

// Server-side client for API routes (alternative method)
export const createServerSupabaseClient = () => {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

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
