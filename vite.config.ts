import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use relative paths for subfolder deployment
// Set BASE_URL environment variable to override (e.g., BASE_URL=/subfolder/ vite build)
const baseUrl = process.env.BASE_URL
const base = baseUrl ? (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`) : './'

export default defineConfig({
  base,
  plugins: [react()],
  optimizeDeps: {
    exclude: ['jieba-wasm'],
  },
  assetsInclude: ['**/*.wasm'],
})
