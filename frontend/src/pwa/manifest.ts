/**
 * Web App Manifest — icone allineate ad Android (densità + maskable/adaptive).
 * Genera asset con: npm run generate-pwa-icons
 */
import { PWA } from '../lib/brand'
import { PWA_ROUTES } from '../lib/pwaRoutes'

const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512] as const
const MASKABLE_SIZES = [192, 512] as const
const MASKABLE_SET = new Set<number>(MASKABLE_SIZES)

export const pwaManifest = {
  id: '/',
  name: 'Aura Syncro',
  /** Etichetta sotto l'icona su Android (max ~12 caratteri consigliati) */
  short_name: 'Aura Syncro',
  description: 'Gestionale ristoranti SaaS — POS, ordini e cucina in tempo reale',
  start_url: PWA_ROUTES.start,
  scope: '/',
  display: 'standalone' as const,
  /** Portrait su telefono; tablet può ruotare in landscape per POS */
  orientation: 'any' as const,
  theme_color: PWA.themeColor,
  background_color: PWA.backgroundColor,
  lang: 'it',
  categories: ['business', 'food'],
  icons: [
    ...STANDARD_SIZES.filter(size => !MASKABLE_SET.has(size)).map(size => ({
      src: `/pwa/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
    ...MASKABLE_SIZES.map(size => ({
      src: `/pwa/maskable-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      /** Zona sicura Android adaptive — sfondo pieno, logo centrato */
      purpose: 'maskable',
    })),
  ],
}

export const pwaIncludeAssets = [
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
]
