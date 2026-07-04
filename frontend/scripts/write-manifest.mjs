/**
 * Scrive manifest.json in public/ per `npm run dev`.
 * In produzione il manifest è generato da vite-plugin-pwa in build.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]
const MASKABLE_SET = new Set(MASKABLE_SIZES)

const manifest = {
  id: '/',
  name: 'Aura Syncro',
  short_name: 'Aura Syncro',
  description: 'Gestionale ristoranti SaaS — POS, ordini e cucina in tempo reale',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  theme_color: '#E5A93C',
  background_color: '#B8921F',
  lang: 'it',
  categories: ['business', 'food'],
  icons: [
    ...STANDARD_SIZES.filter((size) => !MASKABLE_SET.has(size)).map((size) => ({
      src: `/pwa/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
    ...MASKABLE_SIZES.flatMap((size) => [
      {
        src: `/pwa/maskable-${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/pwa/maskable-${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'maskable',
      },
    ]),
  ],
}

writeFileSync(
  join(__dirname, '../public/manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
