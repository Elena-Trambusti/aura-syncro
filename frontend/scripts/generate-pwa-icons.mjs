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

const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]
const ADAPTIVE_DENSITIES = [
  { name: 'mdpi', size: 48 },
  { name: 'hdpi', size: 72 },
  { name: 'xhdpi', size: 96 },
  { name: 'xxhdpi', size: 144 },
  { name: 'xxxhdpi', size: 192 },
]

/** Navy app — sfondo adaptive Android (evita bianco launcher) */
const ADAPTIVE_BG = { r: 11, g: 14, b: 20, alpha: 255 }

/** Logo A+anello — massimo riempimento canvas */
const STANDARD_FILL = 0.94
/** Zona sicura maskable (~80% canvas) */
const MASKABLE_FILL = 0.82

await mkdir(outDir, { recursive: true })
await mkdir(androidDir, { recursive: true })

const logoBuffer = await readFile(logoPath)

/**
 * Estrae solo il marchio scuro (A + anello), ignora squircle oro e frangia bianca.
 * Ritaglia al bounding box del contenuto.
 */
async function buildDarkMarkBuffer() {
  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const ch = info.channels
  const pixels = info.width * info.height
  const out = Buffer.alloc(pixels * 4)

  for (let px = 0; px < pixels; px++) {
    const src = px * ch
    const dst = px * 4
    const r = data[src]
    const g = data[src + 1]
    const b = data[src + 2]
    const a = ch >= 4 ? data[src + 3] : 255
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    const isNearWhite = r > 235 && g > 235 && b > 235
    const isGoldBg = lum > 95 && !isNearWhite
    const isDarkMark = lum < 95 && a > 40 && !isNearWhite

    if (isDarkMark && !isGoldBg) {
      out[dst] = r
      out[dst + 1] = g
      out[dst + 2] = b
      out[dst + 3] = 255
    }
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .png()
    .toBuffer()
}

const darkMarkBuffer = await buildDarkMarkBuffer()

async function markLayer(size, fillRatio) {
  const markSize = Math.max(1, Math.round(size * fillRatio))
  return sharp(darkMarkBuffer)
    .resize(markSize, markSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

/** Icona trasparente — solo logo, nessuno sfondo oro */
async function composeTransparentIcon(size, fillRatio) {
  const mark = await markLayer(size, fillRatio)
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
}

async function writeStandardIcon(size) {
  const png = await composeTransparentIcon(size, STANDARD_FILL)
  await sharp(png).toFile(join(outDir, `icon-${size}.png`))
  console.log(`  icon-${size}.png`)
}

async function writeMaskableIcon(size) {
  const png = await composeTransparentIcon(size, MASKABLE_FILL)
  await sharp(png).toFile(join(outDir, `maskable-${size}.png`))
  console.log(`  maskable-${size}.png`)
}

async function writeAdaptivePair(size, densityName) {
  const foreground = await markLayer(size, MASKABLE_FILL)

  await sharp({
    create: { width: size, height: size, channels: 4, background: ADAPTIVE_BG },
  })
    .png()
    .toFile(join(androidDir, `ic_launcher_background_${densityName}.png`))

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: foreground, gravity: 'center' }])
    .png()
    .toFile(join(androidDir, `ic_launcher_foreground_${densityName}.png`))

  const combined = await sharp({
    create: { width: size, height: size, channels: 4, background: ADAPTIVE_BG },
  })
    .composite([{ input: foreground, gravity: 'center' }])
    .png()
    .toBuffer()

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
  const png = await composeTransparentIcon(size, STANDARD_FILL)
  await sharp(png).toFile(join(outDir, 'apple-touch-icon.png'))
  console.log('  apple-touch-icon.png')
}

console.log('Updating favicon.png (transparent mark, full bleed)…')
{
  const cleanFavicon = await composeTransparentIcon(512, STANDARD_FILL)
  await sharp(cleanFavicon).toFile(logoPath)
  console.log('  favicon.png')
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
  const png = await composeTransparentIcon(size, STANDARD_FILL)
  faviconPngs.push({ width: size, height: size, png })
}
await writeFile(join(publicDir, 'favicon.ico'), createIcoFromPngBuffers(faviconPngs))
console.log('  favicon.ico')

console.log('Generating og-image.jpg…')
const ogWidth = 1200
const ogHeight = 630
const ogBg = '#0B0E14'

const ogLogoSize = Math.round(Math.min(ogWidth, ogHeight) * 0.55)
const ogLogoBuffer = await sharp(darkMarkBuffer)
  .resize(ogLogoSize, ogLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

await sharp({
  create: { width: ogWidth, height: ogHeight, channels: 3, background: ogBg },
})
  .composite([
    {
      input: ogLogoBuffer,
      top: Math.round((ogHeight - ogLogoSize) / 2),
      left: Math.round((ogWidth - ogLogoSize) / 2),
    },
  ])
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(join(publicDir, 'og-image.jpg'))
console.log('  og-image.jpg')

console.log('Done.')
