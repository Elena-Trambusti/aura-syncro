import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
const logoPath = join(publicDir, 'brand', 'aura-syncro-logo-tally.png')
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

const BRAND_NAVY = '#030712'

await mkdir(outDir, { recursive: true })
await mkdir(androidDir, { recursive: true })

const svg = await readFile(logoPath)

/** Icona standard — logo a pieno canvas (purpose: any) */
async function writeStandardIcon(size) {
  await sharp(svg).resize(size, size).png().toFile(join(outDir, `icon-${size}.png`))
  console.log(`  icon-${size}.png`)
}

/**
 * Icona maskable — logo al 58% centrato su sfondo gold (zona sicura ~80% per adaptive icon)
 * @see https://w3c.github.io/manifest/#icon-masks
 */
async function writeMaskableIcon(size) {
  await sharp(svg).resize(size, size).png().toFile(join(outDir, `maskable-${size}.png`))
  console.log(`  maskable-${size}.png`)
}

/** Adaptive Android: foreground (logo su trasparente) + background (tinta piena) */
async function writeAdaptivePair(size, densityName) {
  const logo = await sharp(svg).resize(size, size).png().toBuffer()

  await sharp(logo)
    .toFile(join(androidDir, `ic_launcher_foreground_${densityName}.png`))

  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toFile(join(androidDir, `ic_launcher_background_${densityName}.png`))

  await sharp(logo)
    .toFile(join(androidDir, `ic_launcher_${densityName}.png`))

  console.log(`  android/ic_launcher_${densityName}.png (+ foreground/background)`)
}

console.log('Generating PWA icons…')
for (const size of STANDARD_SIZES) {
  await writeStandardIcon(size)
}
for (const size of MASKABLE_SIZES) {
  await writeMaskableIcon(size)
}

/** iOS home screen — 180×180 con zona sicura */
{
  const size = 180
  const logo = await sharp(svg).resize(size, size).png().toBuffer()
  await sharp(logo).toFile(join(outDir, 'apple-touch-icon.png'))
  console.log('  apple-touch-icon.png')
}

console.log('Generating Android adaptive icons…')
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

console.log('Generating favicon.ico + favicon.png…')
const faviconSizes = [16, 32, 48]
const faviconPngs = []
for (const size of faviconSizes) {
  const png = await sharp(svg).resize(size, size).png().toBuffer()
  faviconPngs.push({ width: size, height: size, png })
}
await writeFile(join(publicDir, 'favicon.ico'), createIcoFromPngBuffers(faviconPngs))
console.log('  favicon.ico')

await sharp(svg).resize(192, 192).png().toFile(join(publicDir, 'favicon.png'))
console.log('  favicon.png')

console.log('Generating og-image.jpg…')
const ogWidth = 1200
const ogHeight = 630
const ogBg = '#FAFAF9'

const tallyMeta = await sharp(logoPath).metadata()
const tallyAspect = (tallyMeta.width ?? 1200) / (tallyMeta.height ?? 320)
const maxLogoWidth = Math.round(ogWidth * 0.7)
const maxLogoHeight = Math.round(ogHeight * 0.55)
let logoWidth = maxLogoWidth
let logoHeight = Math.round(logoWidth / tallyAspect)
if (logoHeight > maxLogoHeight) {
  logoHeight = maxLogoHeight
  logoWidth = Math.round(logoHeight * tallyAspect)
}

const logoBuffer = await sharp(logoPath).resize(logoWidth, logoHeight).png().toBuffer()

await sharp({
  create: { width: ogWidth, height: ogHeight, channels: 3, background: ogBg },
})
  .composite([
    {
      input: logoBuffer,
      top: Math.round((ogHeight - logoHeight) / 2),
      left: Math.round((ogWidth - logoWidth) / 2),
    },
  ])
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(join(publicDir, 'og-image.jpg'))
console.log('  og-image.jpg')

console.log('Done.')
