/**
 * Rende trasparente lo sfondo piatto (bianco/nero) attorno all'icona tally.
 * Uso: node scripts/make-tally-transparent.mjs [input] [output]
 */
import sharp from 'sharp'
import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const brandDir = join(__dirname, '..', 'public', 'brand')
const input = process.argv[2] ?? join(brandDir, 'aura-syncro-logo-tally.png')
const output = process.argv[3] ?? join(brandDir, 'aura-syncro-logo-tally.png')

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info
const stride = channels

function idx(x, y) {
  return (y * width + x) * stride
}

function isBackgroundPixel(i) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  // Bianco piatto
  if (min > 240) return true
  // Nero piatto (angoli fuori dall'icona)
  if (max < 28) return true
  return false
}

const visited = new Uint8Array(width * height)
const queue = []

for (let x = 0; x < width; x++) {
  queue.push([x, 0], [x, height - 1])
}
for (let y = 0; y < height; y++) {
  queue.push([0, y], [width - 1, y])
}

while (queue.length > 0) {
  const [x, y] = queue.pop()
  if (x < 0 || y < 0 || x >= width || y >= height) continue
  const p = y * width + x
  if (visited[p]) continue
  visited[p] = 1
  const i = idx(x, y)
  if (!isBackgroundPixel(i)) continue
  data[i + 3] = 0
  queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
}

const tmp = join(brandDir, '_tally-transparent.png')
await sharp(data, { raw: { width, height, channels } }).png().toFile(tmp)

try {
  if (existsSync(output)) unlinkSync(output)
  copyFileSync(tmp, output)
  unlinkSync(tmp)
  console.log(`OK: ${output}`)
} catch (err) {
  console.error(`Impossibile sovrascrivere ${output} (chiudi il file nell'editor).`)
  console.error(`Salvato in: ${tmp}`)
  process.exitCode = 1
}
