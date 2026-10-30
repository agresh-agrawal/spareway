/// <reference types="vitest/config" />
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { fileURLToPath, URL } from 'node:url'

// `npm run dev:https` serves https on the LAN so phones can use the camera and mic.
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()]
  if (mode === 'https') plugins.push(basicSsl())

  // PWA — owned by Phase 4·Code (vite-plugin-pwa is installed; not enabled yet)

  return {
    plugins,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173 },
    preview: { port: 4173 },
    worker: { format: 'es' },
    build: {
      chunkSizeWarningLimit: 1200,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
