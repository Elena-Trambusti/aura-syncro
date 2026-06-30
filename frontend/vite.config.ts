import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pwaIncludeAssets, pwaManifest } from './src/pwa/manifest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** CSS principale non bloccante: critical styles già inline in index.html. */
function nonBlockingCss(): Plugin {
  return {
    name: 'non-blocking-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        '<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="$1"></noscript>',
      )
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    nonBlockingCss(),
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
    modulePreload: {
      polyfill: false,
      resolveDependencies(_filename, deps) {
        return deps.filter(
          (dep) =>
            !dep.includes('vendor-charts')
            && !dep.includes('html2canvas')
            && !dep.includes('/export-'),
        )
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router') ||
            id.includes('/node_modules/scheduler/')
          ) {
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
