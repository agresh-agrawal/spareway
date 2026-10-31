/// <reference types="vitest/config" />
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// `npm run dev:https` serves https on the LAN so phones can use the camera and mic.
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()]
  if (mode === 'https') plugins.push(basicSsl())

  // PWA — owned by Phase 4·Code (Architecture F21). Installable; app files precached; map tiles / fonts cached as used and by
  // "Save map for offline". Supabase (auth, data, Edge Functions, loader job) is never cached. Off while developing.
  plugins.push(
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      includeAssets: ['icons/*.png', 'brand/*.svg'],
      manifest: {
        name: 'Spareway',
        short_name: 'Spareway',
        description: 'Fill the empty space in your truck — plan loads, routes and extra earnings.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0b',
        theme_color: '#0a0a0b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webp,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // tilejson names the current tile version: fresh when online, saved copy when not
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/planet$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'map-tiles', networkTimeoutSeconds: 4, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  )

  return {
    plugins,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173 },
    preview: { port: 4173 },
    worker: { format: 'es' },
    // pre-bundle the map libraries up front: discovering them on first use reloads the dev server and can
    // leave two copies of React in the page ("Invalid hook call" in react-map-gl)
    optimizeDeps: { include: ['react-map-gl/maplibre', 'maplibre-gl'] },
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
