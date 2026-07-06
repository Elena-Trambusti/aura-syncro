import sharp from 'sharp'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logoToIconPng } from './logoImagePrep.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const brandDir = join(publicDir, 'brand')
const masterLogoPath = join(brandDir, 'aura-syncro-app-icon.png')
const sourceLogoPath = join(brandDir, 'aura-syncro-app-icon.source.png')
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

/** Oro del logo — splash / letterboxing PWA allineato all'icona */
const PWA_BG = '#C9A227'

await mkdir(outDir, { recursive: true })
await mkdir(androidDir, { recursive: true })

let sourcePath = masterLogoPath
try {
  await access(sourceLogoPath)
  sourcePath = sourceLogoPath
} catch {
  try {
    await access(masterLogoPath)
  } catch {
    console.error('Nessun logo trovato in public/brand/')
    process.exit(1)
  }
}

const logoBuffer = await readFile(sourcePath)

async function writeIcon(size, filename) {
  const png = await logoToIconPng(logoBuffer, size)
  await sharp(png).toFile(join(outDir, filename))
  console.log(`  ${filename}`)
}

async function goldCanvas(size) {
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

/** Android adaptive: foreground = logo, background = oro (no trasparenza → no bordi bianchi) */
async function writeAdaptivePair(size, densityName) {
  const icon = await logoToIconPng(logoBuffer, size)
  const background = await goldCanvas(size)

  await sharp(background).toFile(join(androidDir, `ic_launcher_background_${densityName}.png`))
  await sharp(icon).toFile(join(androidDir, `ic_launcher_foreground_${densityName}.png`))
  await sharp(icon).toFile(join(androidDir, `ic_launcher_${densityName}.png`))
  console.log(`  android/ic_launcher_${densityName}.png`)
}

console.log(`Generating PWA icons from ${sourcePath}…`)
for (const size of STANDARD_SIZES) {
  await writeIcon(size, `icon-${size}.png`)
}
for (const size of MASKABLE_SIZES) {
  await writeIcon(size, `maskable-${size}.png`)
}

await writeIcon(180, 'apple-touch-icon.png')

console.log('Updating favicon.png…')
{
  const master512 = await logoToIconPng(logoBuffer, 512)
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
  const png = await logoToIconPng(logoBuffer, size)
  faviconPngs.push({ width: size, height: size, png })
}
await writeFile(join(publicDir, 'favicon.ico'), createIcoFromPngBuffers(faviconPngs))
console.log('  favicon.ico')

console.log('Generating og-image.jpg…')
const ogWidth = 1200
const ogHeight = 630
const ogBg = '#0B0E14'
const ogLogoSize = Math.round(Math.min(ogWidth, ogHeight) * 0.52)
const ogLogoBuffer = await logoToIconPng(logoBuffer, ogLogoSize)

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
