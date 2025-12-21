import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

const manifestConfig = {
  name: 'Hanzi Mistaken Pairs Training',
  short_name: 'Hanzi Training',
  description: 'Train yourself to distinguish between easily confused Chinese characters and words',
  theme_color: '#1976d2',
  background_color: '#ffffff',
  display: 'standalone' as const,
  orientation: 'portrait' as const,
  start_url: './',
  icons: [
    {
      src: 'icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any' as const
    },
    {
      src: 'icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable' as const
    },
    {
      src: 'icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any' as const
    },
    {
      src: 'icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable' as const
    }
  ]
}

const manifestJsonPlugin = (): Plugin => ({
  name: 'manifest-json',
  configureServer(server) {
    server.middlewares.use('/manifest.json', (_, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(manifestConfig))
    })
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    manifestJsonPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'vite.svg'],
      manifest: manifestConfig,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  base: './',
})
