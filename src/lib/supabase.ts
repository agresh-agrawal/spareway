import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { readEnv } from './env'

let client: SupabaseClient<Database> | null = null

/** The one browser client (anon/publishable key only). Created on first use. */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client
  const { env, missing } = readEnv()
  if (!env) throw new Error(`Missing ${missing.join(', ')}`)
  client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  })
  return client
}
