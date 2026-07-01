/**
 * Setup globale Vitest — Aura Syncro business tests.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(__dirname, '../../backend/.env')
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

process.env.NODE_ENV ??= 'test'
