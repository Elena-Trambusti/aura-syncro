import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pwaIncludeAssets, pwaManifest } from './src/pwa/manifest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** CSS principale non bloccante + nessun prefetch chunk dashboard sulla landing. */
function nonBlockingCss(): Plugin {
  return {
    name: 'non-blocking-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      let out = html.replace(
        /<link rel="stylesheet"(?: crossorigin)? href="(\/assets\/[^"]+\.css)">/g,
        '<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="$1"></noscript>',
      )
      // Evita download anticipato di chunk route (recharts, dashboard, landing below-fold, …)
      out = out.replace(/<link rel="modulepreload"[^>]+>/g, (tag) => {
        if (
          tag.includes('recharts')
          || tag.includes('LuxuryAreaChart')
          || tag.includes('LuxuryBarChart')
          || tag.includes('LuxuryLineChart')
          || tag.includes('DashboardPage')
          || tag.includes('AnalyticsPage')
          || tag.includes('ReportsPage')
          || tag.includes('LandingBelowFold')
          || tag.includes('LandingPage')
          || tag.includes('vendor-sentry')
          || tag.includes('vendor-axios')
          || tag.includes('vendor-socket')
          || /\/assets\/(en|es-cn|es|fr|de)-[^"']+\.js/.test(tag)
          || /\/assets\/(banknote|users|utensils|sparkles|trending|triangle|mail|minus|qr-code|check|credit-card|external-link|chevron|loader-circle|AccessDenied)-[^"']+\.js/.test(tag)
        ) {
          return ''
        }
        return tag
      })
      // Script entry con alta priorità
      out = out.replace(
        /<script type="module" crossorigin src="(\/assets\/index-[^"]+\.js)"><\/script>/,
        '<script type="module" crossorigin src="$1" fetchpriority="high"></script>',
      )
      return out
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
      registerType: 'autoUpdate',
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
  optimizeDeps: {
    include: ['qrcode.react'],
  },
  build: {
    modulePreload: {
      polyfill: false,
      resolveDependencies(_filename, deps) {
        return deps.filter(
          (dep) =>
            !dep.includes('html2canvas')
            && !dep.includes('/export-')
            && !dep.includes('vendor-sentry')
            && !dep.includes('/pages/')
            && !dep.includes('DashboardPage')
            && !dep.includes('AnalyticsPage')
            && !dep.includes('ReportsPage')
            && !dep.includes('AIPredictivePage')
            && !dep.includes('PaymentsPage')
            && !dep.includes('ReportFiscal')
            && !dep.includes('LuxuryAreaChart')
            && !dep.includes('LuxuryBarChart')
            && !dep.includes('LuxuryLineChart')
            && !dep.includes('recharts')
            && !/\/(en|es-cn|es|fr|de)-/.test(dep)
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
          if (id.includes('axios')) return 'vendor-axios'
          if (id.includes('socket.io')) return 'vendor-socket'
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
