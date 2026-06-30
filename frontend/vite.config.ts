import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaIncludeAssets, pwaManifest } from './src/pwa/manifest'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifestFilename: 'manifest.json',
      includeAssets: pwaIncludeAssets,
      manifest: pwaManifest,
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  define: {
    'process.env': {},
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) {
            return 'vendor-react'
          }
          if (id.includes('@tanstack')) return 'vendor-query'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('axios') || id.includes('socket.io')) return 'vendor-network'
          if (id.includes('@sentry')) return 'vendor-sentry'
          if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
