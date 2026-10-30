// Entry point only — the app is built from Phase 0 onwards. Kept so `npm run build` and the Vercel deploy work.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(<StrictMode>{null}</StrictMode>)
