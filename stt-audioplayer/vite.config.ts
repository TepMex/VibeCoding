import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..'],
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  publicDir: 'public',
  build: {
    rollupOptions: {
      output: {
        // Ensure model files are copied to dist
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.onnx') || assetInfo.name?.endsWith('.onnx.data')) {
            return 'models/whisper-tiny/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
})
