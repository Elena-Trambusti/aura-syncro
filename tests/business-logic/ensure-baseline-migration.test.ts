import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Test statico: lo script baseline deve gestire schema esistente con tabella migrazioni vuota
 * (caso tipico produzione DO post-squash).
 */
describe('ensure-baseline-migration script', () => {
  const scriptPath = join(
    process.cwd(),
    'backend/scripts/ensure-baseline-migration.ts',
  )
  const source = readFileSync(scriptPath, 'utf8')

  it('non esce subito quando _prisma_migrations è vuota se Restaurant esiste', () => {
    expect(source).toContain('schemaLikelyExists')
    expect(source).not.toMatch(/if \(rows\.length === 0\) return/)
  })

  it('registra INIT_MIGRATION quando lo schema esiste ma la baseline no', () => {
    expect(source).toContain('20250620000000_init')
    expect(source).toContain('migrate resolve --applied')
    expect(source).toContain('schemaLikelyExists')
    expect(source).toMatch(/rows\.length > 0/)
  })

  it('verifica DATABASE_URL prima di connettersi', () => {
    expect(source).toContain('DATABASE_URL mancante')
  })
})
