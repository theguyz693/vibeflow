import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Standalone Vite config for web builds (separate from electron.vite.config.ts)
// Used by: npm run dev:web, npm run build:web, npm run preview:web
export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/',
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
