import sharp from 'sharp'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const brandDir = join(publicDir, 'brand')
const masterLogoPath = join(brandDir, 'aura-syncro-app-icon.png')
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

/** Oro luxury — allineato al logo master (bordi squircle) */
const GOLD_TOP = '#E8D4A8'
const GOLD_MID = '#C9A86A'
const GOLD_BOTTOM = '#9A7B3A'

await mkdir(outDir, { recursive: true })
await mkdir(androidDir, { recursive: true })
await mkdir(brandDir, { recursive: true })

let sourcePath = logoPath
try {
  await access(masterLogoPath)
  sourcePath = masterLogoPath
} catch {
  /* fallback favicon.png */
}

const logoBuffer = await readFile(sourcePath)

function goldGradientSvg(size) {
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="${GOLD_TOP}"/>
      <stop offset="55%" stop-color="${GOLD_MID}"/>
      <stop offset="100%" stop-color="${GOLD_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#gold)"/>
</svg>`)
}

async function goldBackground(size) {
  return sharp(goldGradientSvg(size)).png().toBuffer()
}

/**
 * Logo premium full-bleed: squircle oro su sfondo oro opaco.
 * - niente trasparenza ai bordi (no aloni bianchi su Android/Chrome)
 * - lanczos3 per resize nitido
 */
async function goldLogoPng(size) {
  const bg = await goldBackground(size)
  const mark = await sharp(logoBuffer)
    .resize(size, size, {
      fit: 'cover',
      position: 'centre',
      kernel: 'lanczos3',
    })
    .flatten({ background: GOLD_MID })
    .png()
    .toBuffer()

  return sharp(bg)
    .composite([{ input: mark, gravity: 'center' }])
    .flatten({ background: GOLD_MID })
    .png()
    .toBuffer()
}

async function writeStandardIcon(size) {
  const png = await goldLogoPng(size)
  await sharp(png).toFile(join(outDir, `icon-${size}.png`))
  console.log(`  icon-${size}.png`)
}

async function writeMaskableIcon(size) {
  const png = await goldLogoPng(size)
  await sharp(png).toFile(join(outDir, `maskable-${size}.png`))
  console.log(`  maskable-${size}.png`)
}

/** Adaptive Android: stesso asset oro opaco su fg e bg (no cerchio bianco) */
async function writeAdaptivePair(size, densityName) {
  const logo = await goldLogoPng(size)
  await sharp(logo).toFile(join(androidDir, `ic_launcher_background_${densityName}.png`))
  await sharp(logo).toFile(join(androidDir, `ic_launcher_foreground_${densityName}.png`))
  await sharp(logo).toFile(join(androidDir, `ic_launcher_${densityName}.png`))
  console.log(`  android/ic_launcher_${densityName}.png`)
}

console.log(`Generating PWA icons from ${sourcePath}…`)
for (const size of STANDARD_SIZES) {
  await writeStandardIcon(size)
}
for (const size of MASKABLE_SIZES) {
  await writeMaskableIcon(size)
}

{
  const size = 180
  const png = await goldLogoPng(size)
  await sharp(png).toFile(join(outDir, 'apple-touch-icon.png'))
  console.log('  apple-touch-icon.png')
}

console.log('Updating favicon.png (master 512, full-bleed oro)…')
{
  const master512 = await goldLogoPng(512)
  await sharp(master512).toFile(logoPath)
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
  const png = await goldLogoPng(size)
  faviconPngs.push({ width: size, height: size, png })
}
await writeFile(join(publicDir, 'favicon.ico'), createIcoFromPngBuffers(faviconPngs))
console.log('  favicon.ico')

console.log('Generating og-image.jpg…')
const ogWidth = 1200
const ogHeight = 630
const ogBg = '#020201'
const ogLogoSize = Math.round(Math.min(ogWidth, ogHeight) * 0.52)
const ogLogoBuffer = await goldLogoPng(ogLogoSize)

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
