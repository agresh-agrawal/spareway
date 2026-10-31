import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { setupI18n } from './i18n/setup'
import { initTheme } from './lib/theme'
import { App } from './app/App'

initTheme()
setupI18n()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
