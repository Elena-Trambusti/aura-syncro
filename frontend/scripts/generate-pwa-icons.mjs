import sharp from 'sharp'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logoToSquarePng, stripLogoHalos } from './logoImagePrep.mjs'

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

/** Logo squircle oro — massimo riempimento, sfondo trasparente */
const STANDARD_FILL = 1
/** Navy app — sfondo launcher Android/iOS (evita bordi bianchi) */
const PWA_BG = '#0B0E14'
/** Maskable Android — quasi full-bleed (zona sicura minima) */
const MASKABLE_FILL = 0.92

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
const preparedLogo = await stripLogoHalos(logoBuffer)

/**
 * Logo oro full-bleed su canvas trasparente — nessun margine bianco/nero.
 */
async function transparentLogoPng(size, fillRatio = STANDARD_FILL) {
  return logoToSquarePng(preparedLogo, size, fillRatio)
}

async function transparentCanvas(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer()
}

async function writeStandardIcon(size) {
  const png = await transparentLogoPng(size, STANDARD_FILL)
  await sharp(png).toFile(join(outDir, `icon-${size}.png`))
  console.log(`  icon-${size}.png`)
}

async function navyCanvas(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: PWA_BG,
    },
  })
    .png()
    .toBuffer()
}

async function logoOnNavyPng(size, fillRatio = MASKABLE_FILL) {
  const logo = await transparentLogoPng(size, fillRatio)
  const bg = await navyCanvas(size)
  return sharp(bg).composite([{ input: logo, gravity: 'center' }]).png().toBuffer()
}

async function writeMaskableIcon(size) {
  const png = await logoOnNavyPng(size, MASKABLE_FILL)
  await sharp(png).toFile(join(outDir, `maskable-${size}.png`))
  console.log(`  maskable-${size}.png`)
}

/** Adaptive Android: foreground logo, background navy */
async function writeAdaptivePair(size, densityName) {
  const foreground = await transparentLogoPng(size, MASKABLE_FILL)
  const background = await navyCanvas(size)
  const combined = await logoOnNavyPng(size, MASKABLE_FILL)

  await sharp(background).toFile(join(androidDir, `ic_launcher_background_${densityName}.png`))
  await sharp(foreground).toFile(join(androidDir, `ic_launcher_foreground_${densityName}.png`))
  await sharp(combined).toFile(join(androidDir, `ic_launcher_${densityName}.png`))
  console.log(`  android/ic_launcher_${densityName}.png`)
}

console.log(`Generating PWA icons (transparent) from ${sourcePath}…`)
for (const size of STANDARD_SIZES) {
  await writeStandardIcon(size)
}
for (const size of MASKABLE_SIZES) {
  await writeMaskableIcon(size)
}

{
  const size = 180
  const png = await transparentLogoPng(size, STANDARD_FILL)
  await sharp(png).toFile(join(outDir, 'apple-touch-icon.png'))
  console.log('  apple-touch-icon.png')
}

console.log('Updating favicon.png (logo oro, sfondo trasparente)…')
{
  const master512 = await transparentLogoPng(512, STANDARD_FILL)
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
  const png = await transparentLogoPng(size, STANDARD_FILL)
  faviconPngs.push({ width: size, height: size, png })
}
await writeFile(join(publicDir, 'favicon.ico'), createIcoFromPngBuffers(faviconPngs))
console.log('  favicon.ico')

console.log('Generating og-image.jpg…')
const ogWidth = 1200
const ogHeight = 630
const ogBg = '#0B0E14'
const ogLogoSize = Math.round(Math.min(ogWidth, ogHeight) * 0.52)
const ogLogoBuffer = await transparentLogoPng(ogLogoSize, STANDARD_FILL)

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
