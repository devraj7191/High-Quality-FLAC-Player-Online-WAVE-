import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/saavn-proxy': {
        target: 'https://saavn.dev',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/saavn-proxy/, '')
      }
    }
  }
})