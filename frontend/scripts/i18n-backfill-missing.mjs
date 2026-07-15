/**
 * Deep-merge missing i18n keys from en.json into es/es-cn/fr/de.
 * For es-cn, also fill gaps from es.json when present.
 * Backfill critical reportFiscal.byRegime.*.pdf keys into en from it when missing.
 *
 * Only ADDS missing keys — never overwrites existing translations.
 *
 * Usage: node frontend/scripts/i18n-backfill-missing.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales')

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Deep-merge: add keys from `source` that are missing in `target`. Returns count of leaf keys added. */
function deepMergeMissing(target, source) {
  let added = 0
  if (!isPlainObject(source)) return 0
  if (!isPlainObject(target)) return 0

  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    if (!(key in target)) {
      target[key] = structuredClone(srcVal)
      added += countLeaves(srcVal)
      continue
    }
    const tgtVal = target[key]
    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      added += deepMergeMissing(tgtVal, srcVal)
    }
    // else: skip — do not overwrite existing leaves/arrays
  }
  return added
}

function countLeaves(v) {
  if (!isPlainObject(v)) return 1
  return Object.values(v).reduce((n, child) => n + countLeaves(child), 0)
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, name), 'utf8'))
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(LOCALES_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj)
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!isPlainObject(cur[p])) cur[p] = {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

function pathExists(obj, dotted) {
  const parts = dotted.split('.')
  let cur = obj
  for (const p of parts) {
    if (!isPlainObject(cur) || !(p in cur)) return false
    cur = cur[p]
  }
  return true
}

/** Collect leaf paths under reportFiscal.byRegime.*.pdf */
function collectPdfLeafPaths(byRegime, prefix = 'reportFiscal.byRegime') {
  const paths = []
  if (!isPlainObject(byRegime)) return paths
  for (const regime of Object.keys(byRegime)) {
    const pdf = byRegime[regime]?.pdf
    if (!isPlainObject(pdf)) continue
    for (const key of Object.keys(pdf)) {
      if (!isPlainObject(pdf[key])) {
        paths.push(`${prefix}.${regime}.pdf.${key}`)
      }
    }
  }
  return paths
}

const counts = {}

// 1) Backfill en reportFiscal.byRegime.*.pdf from it when missing
const it = readJson('it.json')
const en = readJson('en.json')
let enPdfAdded = 0
const itPdfPaths = collectPdfLeafPaths(it.reportFiscal?.byRegime)
for (const p of itPdfPaths) {
  if (!pathExists(en, p)) {
    const val = getPath(it, p)
    if (val !== undefined) {
      setPath(en, p, val)
      enPdfAdded += 1
    }
  }
}
if (enPdfAdded > 0) writeJson('en.json', en)
counts['en.json (pdf from it)'] = enPdfAdded

// Reload en after possible write
const enSource = readJson('en.json')

// 2) Merge en → es, fr, de
for (const file of ['es.json', 'fr.json', 'de.json']) {
  const target = readJson(file)
  const added = deepMergeMissing(target, enSource)
  writeJson(file, target)
  counts[file] = added
}

// 3) es-cn: merge en first, then fill remaining from es
const esCn = readJson('es-cn.json')
const es = readJson('es.json')
const fromEn = deepMergeMissing(esCn, enSource)
const fromEs = deepMergeMissing(esCn, es)
writeJson('es-cn.json', esCn)
counts['es-cn.json (from en)'] = fromEn
counts['es-cn.json (from es)'] = fromEs
counts['es-cn.json (total)'] = fromEn + fromEs

console.log('i18n backfill complete:')
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k}: ${v} keys added`)
}
