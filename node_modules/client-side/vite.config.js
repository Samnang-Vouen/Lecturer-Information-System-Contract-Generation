import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {},
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
