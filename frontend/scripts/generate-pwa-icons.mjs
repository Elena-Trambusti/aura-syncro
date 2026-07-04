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

/** Densità Android + PWA (px lato icona quadrata) */
const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]
const ADAPTIVE_DENSITIES = [
  { name: 'mdpi', size: 48 },
  { name: 'hdpi', size: 72 },
  { name: 'xhdpi', size: 96 },
  { name: 'xxhdpi', size: 144 },
  { name: 'xxxhdpi', size: 192 },
]

/** Oro brand — gradiente verticale */
const GOLD_TOP = '#F7E7CE'
const GOLD_BOTTOM = '#B8921F'
const GOLD_TOP_RGB = { r: 247, g: 231, b: 206 }

/**
 * Il favicon sorgente è uno squircle con angoli trasparenti.
 * Ritagliamo la zona centrale (solo logo A + oro piatto) per evitare
 * il doppio bordo visibile sulle adaptive icon Android/Samsung.
 */
const MARK_CROP_INSET_RATIO = 0.14
const STANDARD_MARK_RATIO = 0.62
const MASKABLE_MARK_RATIO = 0.46

await mkdir(outDir, { recursive: true })
await mkdir(androidDir, { recursive: true })

const logoBuffer = await readFile(logoPath)
const logoMeta = await sharp(logoBuffer).metadata()
const sourceSize = logoMeta.width ?? 192
const markInset = Math.round(sourceSize * MARK_CROP_INSET_RATIO)
const markCropSize = sourceSize - markInset * 2

/** Logo centrale senza il contorno arrotondato dello squircle */
const logoMarkBuffer = await sharp(logoBuffer)
  .flatten({ background: GOLD_TOP_RGB })
  .extract({ left: markInset, top: markInset, width: markCropSize, height: markCropSize })
  .png()
  .toBuffer()

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

async function markLayer(size, ratio) {
  const markSize = Math.max(1, Math.round(size * ratio))
  return sharp(logoMarkBuffer)
    .resize(markSize, markSize, { fit: 'contain' })
    .png()
    .toBuffer()
}

/** Icona full-bleed: sfondo oro fino ai bordi, zero trasparenza */
async function composeFullBleedIcon(size, markRatio) {
  const bg = await goldBackground(size)
  const mark = await markLayer(size, markRatio)
  return sharp(bg)
    .composite([{ input: mark, gravity: 'center' }])
    .removeAlpha()
    .png()
    .toBuffer()
}

async function writeStandardIcon(size) {
  const png = await composeFullBleedIcon(size, STANDARD_MARK_RATIO)
  await sharp(png).toFile(join(outDir, `icon-${size}.png`))
  console.log(`  icon-${size}.png`)
}

async function writeMaskableIcon(size) {
  const png = await composeFullBleedIcon(size, MASKABLE_MARK_RATIO)
  await sharp(png).toFile(join(outDir, `maskable-${size}.png`))
  console.log(`  maskable-${size}.png`)
}

async function writeAdaptivePair(size, densityName) {
  const bg = await goldBackground(size)
  const mark = await markLayer(size, MASKABLE_MARK_RATIO)

  await sharp(bg).removeAlpha().toFile(join(androidDir, `ic_launcher_background_${densityName}.png`))

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(androidDir, `ic_launcher_foreground_${densityName}.png`))

  const combined = await composeFullBleedIcon(size, MASKABLE_MARK_RATIO)
  await sharp(combined).toFile(join(androidDir, `ic_launcher_${densityName}.png`))

  console.log(`  android/ic_launcher_${densityName}.png (+ foreground/background)`)
}

console.log('Generating PWA icons…')
for (const size of STANDARD_SIZES) {
  await writeStandardIcon(size)
}
for (const size of MASKABLE_SIZES) {
  await writeMaskableIcon(size)
}

{
  const size = 180
  const png = await composeFullBleedIcon(size, STANDARD_MARK_RATIO)
  await sharp(png).toFile(join(outDir, 'apple-touch-icon.png'))
  console.log('  apple-touch-icon.png')
}

console.log('Generating Android adaptive icons…')
for (const { name, size } of ADAPTIVE_DENSITIES) {
  await writeAdaptivePair(size, name)
}

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

console.log('Generating favicon.ico…')
const faviconSizes = [16, 32, 48]
const faviconPngs = []
for (const size of faviconSizes) {
  const png = await composeFullBleedIcon(size, STANDARD_MARK_RATIO)
  faviconPngs.push({ width: size, height: size, png })
}
await writeFile(join(publicDir, 'favicon.ico'), createIcoFromPngBuffers(faviconPngs))
console.log('  favicon.ico')

console.log('Generating og-image.jpg…')
const ogWidth = 1200
const ogHeight = 630
const ogBg = '#020201'

const ogLogoMeta = await sharp(logoPath).metadata()
const logoAspect = (ogLogoMeta.width ?? 1) / (ogLogoMeta.height ?? 1)
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
