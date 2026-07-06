/**
 * Copia il logo master ufficiale e genera varianti display (solo resize).
 * Sorgente: public/brand/aura-syncro-app-icon.source.png
 */
import { readFile, writeFile, copyFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { logoToDisplayWebp } from './logoImagePrep.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const brandDir = join(__dirname, '..', 'public', 'brand')
const masterPath = join(brandDir, 'aura-syncro-app-icon.png')
const masterRawPath = join(brandDir, 'aura-syncro-app-icon.source.png')

try {
  await access(masterRawPath)
} catch {
  console.error('Manca aura-syncro-app-icon.source.png — inserisci il logo ufficiale in public/brand/')
  process.exit(1)
}

console.log(`Preparing brand logo from ${masterRawPath}…`)
const raw = await readFile(masterRawPath)

await copyFile(masterRawPath, masterPath)
console.log('  aura-syncro-app-icon.png (copia fedele del master)')

await writeFile(join(brandDir, 'aura-syncro-logo-display.webp'), await logoToDisplayWebp(raw, 112))
console.log('  aura-syncro-logo-display.webp')

await writeFile(join(brandDir, 'aura-syncro-logo-display-40.webp'), await logoToDisplayWebp(raw, 40))
console.log('  aura-syncro-logo-display-40.webp')

await sharp(raw).png({ compressionLevel: 9 }).toFile(join(brandDir, 'aura-syncro-app-icon.png'))
console.log('Done.')
