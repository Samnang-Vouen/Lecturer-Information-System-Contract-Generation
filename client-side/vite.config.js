import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Workaround for lucide-react referencing missing ./icons/chrome.js in 0.539.0
      'lucide-react/dist/esm/icons/chrome.js': '/src/icon-stubs/chrome.js',
      'lucide-react/dist/esm/icons/chrome': '/src/icon-stubs/chrome.js'
    }
  },
  optimizeDeps: {
    // Defer heavy libs to dynamic import if needed
    exclude: ['xlsx']
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('xlsx')) return 'xlsx';
        }
      }
    }
  }
})
