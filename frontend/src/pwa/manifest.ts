/**
 * Web App Manifest — icone allineate ad Android (densità + maskable/adaptive).
 * Genera asset con: npm run generate-pwa-icons
 */
import { BRAND_LOGO_VERSION, PWA } from '../lib/brand'
import { PWA_ROUTES } from '../lib/pwaRoutes'

const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512] as const
const MASKABLE_SIZES = [192, 512] as const
const MASKABLE_SET = new Set<number>(MASKABLE_SIZES)

const iconSrc = (path: string) => `${path}?v=${BRAND_LOGO_VERSION}`

const shortcutIcon = {
  src: iconSrc('/pwa/maskable-192.png'),
  sizes: '192x192',
  type: 'image/png',
} as const

export const pwaManifest = {
  id: '/',
  name: 'Aura Syncro',
  /** Etichetta sotto l'icona su Android (max ~12 caratteri consigliati) */
  short_name: 'Aura Syncro',
  description: 'Gestionale ristoranti SaaS — POS, ordini e cucina in tempo reale',
  start_url: PWA_ROUTES.start,
  scope: '/',
  display: 'standalone' as const,
  display_override: ['standalone', 'minimal-ui'] as Array<'standalone' | 'minimal-ui'>,
  /** Portrait su telefono; tablet può ruotare in landscape per POS */
  orientation: 'any' as const,
  theme_color: PWA.themeColor,
  background_color: PWA.backgroundColor,
  lang: 'it',
  dir: 'ltr' as const,
  categories: ['business', 'food'],
  icons: [
    ...STANDARD_SIZES.filter(size => !MASKABLE_SET.has(size)).map(size => ({
      src: iconSrc(`/pwa/icon-${size}.png`),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
    // Icone safe-zone richieste da Play Store / PWABuilder (192 + 512)
    ...MASKABLE_SIZES.map(size => ({
      src: iconSrc(`/pwa/icon-${size}.png`),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
    ...MASKABLE_SIZES.flatMap(size => [
      {
        src: iconSrc(`/pwa/maskable-${size}.png`),
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'maskable',
      },
    ]),
  ],
  shortcuts: [
    {
      name: 'Accedi',
      short_name: 'Login',
      url: PWA_ROUTES.start,
      icons: [shortcutIcon],
    },
    {
      name: 'Ordini',
      short_name: 'Ordini',
      url: PWA_ROUTES.orders,
      icons: [shortcutIcon],
    },
  ],
  screenshots: [
    {
      src: iconSrc('/og-image.jpg'),
      sizes: '1200x630',
      type: 'image/jpeg',
      form_factor: 'wide' as const,
      label: 'Aura Syncro — gestionale cloud per ristoranti',
    },
    {
      src: iconSrc('/pwa/maskable-512.png'),
      sizes: '512x512',
      type: 'image/png',
      form_factor: 'narrow' as const,
      label: 'Aura Syncro — app mobile',
    },
  ],
  prefer_related_applications: false,
  related_applications: [],
}

export const pwaIncludeAssets = [
  'brand/aura-syncro-app-icon.png',
  'favicon.png',
  'favicon.ico',
  ...STANDARD_SIZES.map(s => `pwa/icon-${s}.png`),
  ...MASKABLE_SIZES.map(s => `pwa/maskable-${s}.png`),
  'pwa/apple-touch-icon.png',
  'pwa/android/ic_launcher_mdpi.png',
  'pwa/android/ic_launcher_hdpi.png',
  'pwa/android/ic_launcher_xhdpi.png',
  'pwa/android/ic_launcher_xxhdpi.png',
  'pwa/android/ic_launcher_xxxhdpi.png',
  'og-image.jpg',
]
