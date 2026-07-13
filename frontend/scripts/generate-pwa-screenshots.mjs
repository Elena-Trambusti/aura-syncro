/**
 * Screenshot PWA per manifest / Play Store listing.
 * narrow: 1080×1920 (mobile) · wide: 1920×1080 (desktop)
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '../public')
const outDir = join(publicDir, 'screenshots')
const logoPath = join(publicDir, 'pwa/maskable-512.png')
const ogPath = join(publicDir, 'og-image.jpg')

const NAVY = { r: 11, g: 14, b: 20, alpha: 1 }

await mkdir(outDir, { recursive: true })

/** Mobile portrait — logo su sfondo navy */
const narrowW = 1080
const narrowH = 1920
const logoSize = 420

const logoBuf = await sharp(logoPath).resize(logoSize, logoSize).png().toBuffer()
const narrowBase = await sharp({
  create: {
    width: narrowW,
    height: narrowH,
    channels: 4,
    background: NAVY,
  },
})
  .composite([
    { input: logoBuf, gravity: 'center' },
  ])
  .png()
  .toBuffer()

await sharp(narrowBase)
  .extend({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: NAVY,
  })
  .png()
  .toFile(join(outDir, 'mobile-portrait.png'))

/** Desktop wide — og-image in 16:9 */
const wideW = 1920
const wideH = 1080

await sharp(ogPath)
  .resize(wideW, wideH, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 88 })
  .toFile(join(outDir, 'desktop-wide.jpg'))

console.log('  screenshots/mobile-portrait.png')
console.log('  screenshots/desktop-wide.jpg')
