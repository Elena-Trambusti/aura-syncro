/**
 * Rigenera master logo pulito + display WebP.
 * Uso: node scripts/prepare-brand-logo.mjs
 */
import { readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { logoToDisplayWebp, stripLogoHalos } from './logoImagePrep.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const brandDir = join(publicDir, 'brand')
const masterPath = join(brandDir, 'aura-syncro-app-icon.png')
const masterRawPath = join(brandDir, 'aura-syncro-app-icon.source.png')

let sourcePath = masterPath
try {
  await access(masterRawPath)
  sourcePath = masterRawPath
} catch {
  /* usa master corrente */
}

console.log(`Preparing brand logo from ${sourcePath}…`)
const raw = await readFile(sourcePath)
const prepared = await stripLogoHalos(raw)

await sharp(prepared).png({ compressionLevel: 9 }).toFile(masterPath)
console.log('  aura-syncro-app-icon.png (trimmed, full-bleed)')

await writeFile(join(brandDir, 'aura-syncro-logo-display.webp'), await logoToDisplayWebp(prepared, 112))
console.log('  aura-syncro-logo-display.webp')

await writeFile(join(brandDir, 'aura-syncro-logo-display-40.webp'), await logoToDisplayWebp(prepared, 40))
console.log('  aura-syncro-logo-display-40.webp')

console.log('Done.')
