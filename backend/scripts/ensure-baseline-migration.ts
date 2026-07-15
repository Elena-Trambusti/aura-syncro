/**
 * One-time squash: DB produzione con storico migrazioni incrementali legacy
 * → singola baseline `20250620000000_init` (già applicata implicitamente).
 * Su DB vuoto (CI) non fa nulla: `migrate deploy` applica la baseline.
 */
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const INIT_MIGRATION = '20250620000000_init'

async function main(): Promise<void> {
  const prisma = new PrismaClient()

  try {
    type Row = { migration_name: string }
    let rows: Row[] = []

    try {
      rows = await prisma.$queryRaw<Row[]>`
        SELECT migration_name FROM "_prisma_migrations"
      `
    } catch {
      // Tabella assente: primo avvio su DB vuoto.
      return
    }

    if (rows.length === 0) return

    const names = rows.map(r => r.migration_name)
    const hasInitOnly = names.length === 1 && names[0] === INIT_MIGRATION
    if (hasInitOnly) return

    const hasLegacy = names.some(name => name !== INIT_MIGRATION)
    if (!hasLegacy) return

    console.log(
      `[prisma] Baseline: ${names.length} migrazioni legacy → segno "${INIT_MIGRATION}" come applicata (schema già presente).`,
    )
    await prisma.$executeRaw`DELETE FROM "_prisma_migrations"`
  } finally {
    await prisma.$disconnect()
  }

  execSync(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`, {
    stdio: 'inherit',
    env: process.env,
  })
}

main().catch(err => {
  console.error('[prisma] ensure-baseline-migration failed:', err)
  process.exit(1)
})
