import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': join(__dirname, '..'),
      '@render': __dirname,
    },
  },
  base: './',
  build: {
    outDir: join(__dirname, '../../dist/render'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
  },
})