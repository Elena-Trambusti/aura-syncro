import sharp from 'sharp'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'brand', 'aura-syncro-icon.svg')
const outDir = join(root, 'public', 'pwa')

await mkdir(outDir, { recursive: true })
const svg = await readFile(svgPath)

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`))
  console.log(`Generated icon-${size}.png`)
}
