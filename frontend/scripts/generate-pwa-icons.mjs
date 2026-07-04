import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const logoPath = join(publicDir, 'favicon.png')
const outDir = join(publicDir, 'pwa')
const androidDir = join(outDir, 'android')

/** Densit├á Android + PWA (px lato icona quadrata) */
const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]
const ADAPTIVE_DENSITIES = [
  { name: 'mdpi', size: 48 },
  { name: 'hdpi', size: 72 },
  { name: 'xhdpi', size: 96 },
  { name: 'xxhdpi', size: 144 },
  { name: 'xxxhdpi', size: 192 },
]

/** Oro brand ÔÇö gradiente verticale come il logo ufficiale */
const GOLD_TOP = '#F7E7CE'
const GOLD_BOTTOM = '#B8921F'

/** Zona sicura maskable Android (~80% cerchio centrale) */
const MASKABLE_LOGO_RATIO = 0.54
/** Icona standard ÔÇö logo quasi a tutto campo, senza trasparenza ai bordi */
const STANDARD_LOGO_RATIO = 0.92

await mkdir(outDir, { recursive: true })
await mkdir(androidDir, { recursive: true })

const logoBuffer = await readFile(logoPath)

function goldGradientSvg(size) {
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${GOLD_TOP}"/>
      <stop offset="100%" stop-color="${GOLD_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#gold)"/>
</svg>`)
}

async function goldBackground(size) {
  return sharp(goldGradientSvg(size)).png().toBuffer()
}

async function logoLayer(size, ratio) {
  const logoSize = Math.max(1, Math.round(size * ratio))
  return sharp(logoBuffer).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer()
}

/** Composita logo su sfondo oro pieno ÔÇö nessun pixel trasparente ai bordi */
async function composeIcon(size, ratio) {
  const bg = await goldBackground(size)
  const logo = await logoLayer(size, ratio)
  return sharp(bg).composite([{ input: logo, gravity: 'center' }]).png().toBuffer()
}

/** Icona standard ÔÇö purpose: any */
async function writeStandardIcon(size) {
  const png = await composeIcon(size, STANDARD_LOGO_RATIO)
  await sharp(png).toFile(join(outDir, `icon-${size}.png`))
  console.log(`  icon-${size}.png`)
}

/**
 * Icona maskable ÔÇö logo nella zona sicura centrale su sfondo oro pieno.
 * @see https://w3c.github.io/manifest/#icon-masks
 */
async function writeMaskableIcon(size) {
  const png = await composeIcon(size, MASKABLE_LOGO_RATIO)
  await sharp(png).toFile(join(outDir, `maskable-${size}.png`))
  console.log(`  maskable-${size}.png`)
}

/** Adaptive Android: foreground (logo) + background (oro pieno) */
async function writeAdaptivePair(size, densityName) {
  const bg = await goldBackground(size)
  const logo = await logoLayer(size, MASKABLE_LOGO_RATIO)

  await sharp(bg).toFile(join(androidDir, `ic_launcher_background_${densityName}.png`))

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(androidDir, `ic_launcher_foreground_${densityName}.png`))

  await sharp(bg).composite([{ input: logo, gravity: 'center' }]).toFile(join(androidDir, `ic_launcher_${densityName}.png`))

  console.log(`  android/ic_launcher_${densityName}.png (+ foreground/background)`)
}

console.log('Generating PWA iconsÔÇª')
for (const size of STANDARD_SIZES) {
  await writeStandardIcon(size)
}
for (const size of MASKABLE_SIZES) {
  await writeMaskableIcon(size)
}

/** iOS home screen ÔÇö 180├ù180 full-bleed, nessuna trasparenza */
{
  const size = 180
  const png = await composeIcon(size, STANDARD_LOGO_RATIO)
  await sharp(png).toFile(join(outDir, 'apple-touch-icon.png'))
  console.log('  apple-touch-icon.png')
}

console.log('Generating Android adaptive iconsÔÇª')
for (const { name, size } of ADAPTIVE_DENSITIES) {
  await writeAdaptivePair(size, name)
}

/** ICO multi-risoluzione (PNG embedded, supporto Vista+) */
function createIcoFromPngBuffers(images) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  let offset = 6 + count * 16
  const entries = []
  const bodies = []

  for (const { width, height, png } of images) {
    const entry = Buffer.alloc(16)
    entry[0] = width >= 256 ? 0 : width
    entry[1] = height >= 256 ? 0 : height
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    bodies.push(png)
    offset += png.length
  }

  return Buffer.concat([header, ...entries, ...bodies])
}

console.log('Generating favicon.icoÔÇª')
const faviconSizes = [16, 32, 48]
const faviconPngs = []
for (const size of faviconSizes) {
  const png = await composeIcon(size, STANDARD_LOGO_RATIO)
  faviconPngs.push({ width: size, height: size, png })
}
await writeFile(join(publicDir, 'favicon.ico'), createIcoFromPngBuffers(faviconPngs))
console.log('  favicon.ico')

console.log('Generating og-image.jpgÔÇª')
const ogWidth = 1200
const ogHeight = 630
const ogBg = '#020201'

const logoMeta = await sharp(logoPath).metadata()
const logoAspect = (logoMeta.width ?? 1) / (logoMeta.height ?? 1)
const maxLogoWidth = Math.round(ogWidth * 0.42)
const maxLogoHeight = Math.round(ogHeight * 0.72)
let logoWidth = maxLogoWidth
let logoHeight = Math.round(logoWidth / logoAspect)
if (logoHeight > maxLogoHeight) {
  logoHeight = maxLogoHeight
  logoWidth = Math.round(logoHeight * logoAspect)
}

const ogLogoBuffer = await sharp(logoPath).resize(logoWidth, logoHeight).png().toBuffer()

await sharp({
  create: { width: ogWidth, height: ogHeight, channels: 3, background: ogBg },
})
  .composite([
    {
      input: ogLogoBuffer,
      top: Math.round((ogHeight - logoHeight) / 2),
      left: Math.round((ogWidth - logoWidth) / 2),
    },
  ])
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(join(publicDir, 'og-image.jpg'))
console.log('  og-image.jpg')

console.log('Done.')
