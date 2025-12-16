import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Set BASE_URL environment variable to deploy in a subfolder (e.g., BASE_URL=/subfolder/ vite build)
const baseUrl = process.env.BASE_URL || '/'
const base = baseUrl === '/' ? '/' : baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`

export default defineConfig({
  base,
  plugins: [react()],
  optimizeDeps: {
    exclude: ['jieba-wasm'],
  },
  assetsInclude: ['**/*.wasm'],
})
