import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Sunucusuz (P2P) derlemede dosyalar göreli yollardan yüklenir; böylece
  // GitHub Pages'in alt dizin adreslerinde (kullanici.github.io/depo/) çalışır.
  const isP2P = mode === 'p2p'

  return {
    base: isP2P ? './' : '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      open: false,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
  }
})