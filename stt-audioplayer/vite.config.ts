import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Plugin to handle missing WASM imports gracefully
const wasmPlugin = () => ({
  name: 'wasm-import-handler',
  resolveId(id: string, importer?: string) {
    // Check if this is a WASM import
    if (id.includes('wasm_fuzzy.js') || id.includes('wasm-fuzzy/pkg/wasm_fuzzy.js')) {
      // Try to resolve the actual path
      let resolvedPath: string | null = null;
      if (importer) {
        try {
          resolvedPath = resolve(importer, '..', '..', 'wasm-fuzzy', 'pkg', 'wasm_fuzzy.js');
        } catch {
          // Ignore resolution errors
        }
      }
      
      // If file doesn't exist, provide a stub
      if (!resolvedPath || !existsSync(resolvedPath)) {
        return '\0wasm-fuzzy-stub';
      }
      
      // File exists, let Vite handle it normally
      return null;
    }
    return null;
  },
  load(id: string) {
    // Provide a stub module that throws (will be caught by try-catch in fuzzySearch.ts)
    if (id === '\0wasm-fuzzy-stub') {
      return 'throw new Error("WASM module not built");';
    }
    return null;
  },
});

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), wasmPlugin()],
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
  optimizeDeps: {
    exclude: ['wasm-fuzzy'],
  },
  resolve: {
    alias: {
      // Allow dynamic WASM imports to fail gracefully
    },
  },
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
  worker: {
    format: 'es',
  },
})
