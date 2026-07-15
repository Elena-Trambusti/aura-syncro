/**
 * Baseline squash: DB produzione con storico legacy o schema già presente
 * senza riga `20250620000000_init` → segna la baseline come applicata senza rieseguire SQL.
 * DB vuoto (CI) → non fa nulla; `migrate deploy` applica la baseline.
 */
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const INIT_MIGRATION = '20250620000000_init'

function markInitApplied(): void {
  execSync(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`, {
    stdio: 'inherit',
    env: process.env,
  })
}

async function tableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `
  return Boolean(rows[0]?.exists)
}

async function schemaLikelyExists(prisma: PrismaClient): Promise<boolean> {
  return tableExists(prisma, 'Restaurant')
}

type MigrationRow = { migration_name: string; finished_at: Date | null }

async function readMigrationRows(prisma: PrismaClient): Promise<MigrationRow[]> {
  if (!(await tableExists(prisma, '_prisma_migrations'))) {
    return []
  }
  return prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name, finished_at FROM "_prisma_migrations"
  `
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL mancante — impossibile eseguire migrazioni')
  }
  if (!process.env.DIRECT_URL?.trim()) {
    console.warn(
      '[prisma] WARN: DIRECT_URL non impostato — migrate deploy può fallire con pooler (PgBouncer).',
    )
  }

  const prisma = new PrismaClient()

  try {
    const schemaExists = await schemaLikelyExists(prisma)
    const rows = await readMigrationRows(prisma)
    const names = rows.map(r => r.migration_name)

    const initApplied = rows.some(
      r => r.migration_name === INIT_MIGRATION && r.finished_at != null,
    )
    if (initApplied) {
      console.log(`[prisma] Baseline "${INIT_MIGRATION}" già registrata (${names.length} migrazioni).`)
      return
    }

    if (!schemaExists) {
      console.log('[prisma] DB vuoto — migrate deploy applicherà la baseline.')
      return
    }

    const legacyCount = names.filter(n => n !== INIT_MIGRATION).length
    console.log(
      `[prisma] Schema già presente (${legacyCount} migrazioni legacy, ${names.length} totali) → baseline "${INIT_MIGRATION}" senza rieseguire SQL.`,
    )

    if (rows.length > 0) {
      await prisma.$executeRaw`DELETE FROM "_prisma_migrations"`
    }
  } finally {
    await prisma.$disconnect()
  }

  markInitApplied()
}

main().catch(err => {
  console.error('[prisma] ensure-baseline-migration failed:', err)
  process.exit(1)
})
