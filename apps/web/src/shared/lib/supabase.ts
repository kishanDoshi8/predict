import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/lib/supabase.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env.local and fill in your values.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnon)
