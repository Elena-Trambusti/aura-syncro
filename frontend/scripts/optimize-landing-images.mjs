/**
 * Ottimizza asset critici per PageSpeed (landing LCP).
 * Uso: node scripts/optimize-landing-images.mjs
 */
import sharp from 'sharp'
import { access, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const assetsDir = join(publicDir, 'assets')
const brandDir = join(publicDir, 'brand')

await mkdir(assetsDir, { recursive: true })
await mkdir(brandDir, { recursive: true })

async function requireFile(path) {
  await access(path)
  return path
}

async function writeWebp(inputPath, outputPath, { width, quality = 78 } = {}) {
  let pipeline = sharp(inputPath)
  if (width) {
    pipeline = pipeline.resize(width, null, { withoutEnlargement: true, fit: 'inside' })
  }
  const info = await pipeline.webp({ quality, effort: 6 }).toFile(outputPath)
  console.log(`  ${outputPath.replace(publicDir, '')} (${Math.round(info.size / 1024)} KiB)`)
}

console.log('Optimizing marble background…')
const marblePath = await requireFile(join(assetsDir, 'marble-bg.png'))
await writeWebp(marblePath, join(assetsDir, 'marble-bg-768.webp'), { width: 768, quality: 72 })
await writeWebp(marblePath, join(assetsDir, 'marble-bg-1920.webp'), { width: 1920, quality: 76 })
await writeWebp(marblePath, join(assetsDir, 'marble-bg.webp'), { width: 1280, quality: 74 })

console.log('Optimizing logo display sizes…')
const logoPath = await requireFile(join(brandDir, 'aura-syncro-app-icon.png'))
await writeWebp(logoPath, join(brandDir, 'aura-syncro-logo-display.webp'), {
  width: 112,
  quality: 85,
})
await writeWebp(logoPath, join(brandDir, 'aura-syncro-logo-display-40.webp'), {
  width: 40,
  quality: 85,
})

console.log('Optimizing floor plan preview…')
const floorPath = await requireFile(join(brandDir, 'tavoli-floor-plan-25d.png'))
await writeWebp(floorPath, join(brandDir, 'tavoli-floor-plan-25d-680.webp'), {
  width: 680,
  quality: 80,
})
await writeWebp(floorPath, join(brandDir, 'tavoli-floor-plan-25d.webp'), {
  width: 1024,
  quality: 82,
})

console.log('Done.')
