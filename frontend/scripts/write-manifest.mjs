/**
 * Scrive manifest.json in public/ per `npm run dev`.
 * In produzione il manifest è generato da vite-plugin-pwa in build.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICON_V = '?v=19'

const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]
const MASKABLE_SET = new Set(MASKABLE_SIZES)

const iconSrc = (path) => `${path}${ICON_V}`

const shortcutIcon = {
  src: iconSrc('/pwa/maskable-192.png'),
  sizes: '192x192',
  type: 'image/png',
}

const manifest = {
  id: '/',
  name: 'Aura Syncro',
  short_name: 'Aura Syncro',
  description: 'Gestionale ristoranti SaaS — POS, ordini e cucina in tempo reale',
  start_url: '/login?pwa=1',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  orientation: 'any',
  theme_color: '#0B0E14',
  background_color: '#C9A227',
  lang: 'it',
  dir: 'ltr',
  categories: ['business', 'food'],
  icons: [
    ...STANDARD_SIZES.filter((size) => !MASKABLE_SET.has(size)).map((size) => ({
      src: iconSrc(`/pwa/icon-${size}.png`),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
    ...MASKABLE_SIZES.map((size) => ({
      src: iconSrc(`/pwa/icon-${size}.png`),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
    ...MASKABLE_SIZES.map((size) => ({
      src: iconSrc(`/pwa/maskable-${size}.png`),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'maskable',
    })),
  ],
  shortcuts: [
    {
      name: 'Accedi',
      short_name: 'Login',
      url: '/login?pwa=1',
      icons: [shortcutIcon],
    },
    {
      name: 'Ordini',
      short_name: 'Ordini',
      url: '/ordini',
      icons: [shortcutIcon],
    },
  ],
  screenshots: [
    {
      src: iconSrc('/screenshots/desktop-wide.jpg'),
      sizes: '1920x1080',
      type: 'image/jpeg',
      form_factor: 'wide',
      label: 'Aura Syncro — gestionale cloud per ristoranti',
    },
    {
      src: iconSrc('/screenshots/mobile-portrait.png'),
      sizes: '1080x1920',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Aura Syncro — app mobile POS',
    },
  ],
  launch_handler: {
    client_mode: 'navigate-existing',
  },
  handle_links: 'preferred',
  prefer_related_applications: false,
  related_applications: [],
}

writeFileSync(
  join(__dirname, '../public/manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
