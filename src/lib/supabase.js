import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when Supabase env vars are present. */
export function isSupabaseConfigured() {
  return Boolean(url && anonKey)
}

/** Supabase client (null until env vars are configured). */
export const supabase = isSupabaseConfigured() ? createClient(url, anonKey) : null
