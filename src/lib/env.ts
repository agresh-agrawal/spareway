// Env is read lazily so `npm run build` works without any .env (cloud agent). A missing value
// shows a full-page message at runtime instead of throwing at import time.

export interface AppEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  mapStyleUrl: string
}

export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/dark'

export function readEnv(source: Record<string, string | undefined> = import.meta.env as unknown as Record<string, string | undefined>): {
  env: AppEnv | null
  missing: string[]
} {
  const supabaseUrl = source.VITE_SUPABASE_URL?.trim() ?? ''
  const supabaseAnonKey = source.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter((v): v is string => Boolean(v))
  if (missing.length) return { env: null, missing }
  return {
    env: { supabaseUrl, supabaseAnonKey, mapStyleUrl: source.VITE_MAP_STYLE_URL?.trim() || OPENFREEMAP_STYLE },
    missing,
  }
}
