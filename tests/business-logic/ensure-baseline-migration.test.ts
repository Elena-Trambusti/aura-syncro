import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Test statico sul runner migrazioni produzione (DigitalOcean PRE_DEPLOY). */
describe('migrate-production.mjs', () => {
  const scriptPath = join(process.cwd(), 'backend/scripts/migrate-production.mjs')
  const source = readFileSync(scriptPath, 'utf8')

  it('usa DIRECT_URL per le operazioni di migrazione', () => {
    expect(source).toContain('DIRECT_URL')
    expect(source).toContain('migrationDatabaseUrl')
  })

  it('rileva schema esistente via pg_catalog (Restaurant/User/Order)', () => {
    expect(source).toContain('pg_catalog.pg_class')
    expect(source).toContain('Restaurant')
  })

  it('fallback inserimento manuale baseline', () => {
    expect(source).toContain('markInitAppliedManual')
    expect(source).toContain('createHash')
  })

  it('entrypoint npm run db:migrate senza tsx', () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'backend/package.json'), 'utf8'),
    )
    expect(pkg.scripts['db:migrate']).toContain('migrate-production.mjs')
    expect(pkg.scripts['db:migrate']).not.toContain('tsx')
  })

  it('esegue sempre prisma generate (niente skip su directory esistente)', () => {
    expect(source).toContain("run('npx prisma generate')")
    expect(source).not.toContain('già generato — skip generate')
  })
})
