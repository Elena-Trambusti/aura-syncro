/**
 * Migrazioni produzione / PRE_DEPLOY DigitalOcean.
 * - Usa DIRECT_URL (no pooler) per admin lock e DDL
 * - Baseline schema legacy senza rieseguire SQL
 * - Retry migrate deploy se il DB esiste già
 */
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const INIT_MIGRATION = '20250620000000_init'

function migrationDatabaseUrl() {
  const direct = process.env.DIRECT_URL?.trim()
  const pooled = process.env.DATABASE_URL?.trim()
  if (!direct && !pooled) {
    throw new Error('DATABASE_URL mancante — impossibile eseguire migrazioni')
  }
  if (!direct) {
    console.warn(
      '[prisma] WARN: DIRECT_URL non impostato — uso DATABASE_URL (migrate può fallire con PgBouncer).',
    )
  }
  return direct || pooled
}

function migrationEnv() {
  const url = migrationDatabaseUrl()
  return { ...process.env, DATABASE_URL: url, DIRECT_URL: url }
}

function run(cmd) {
  console.log(`[prisma] $ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env: migrationEnv() })
}

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = ${tableName}
    ) AS "exists"
  `
  return Boolean(rows[0]?.exists)
}

async function schemaLikelyExists(prisma) {
  for (const name of ['Restaurant', 'User', 'Order']) {
    if (await tableExists(prisma, name)) return true
  }
  return false
}

async function readMigrationRows(prisma) {
  if (!(await tableExists(prisma, '_prisma_migrations'))) {
    return []
  }
  return prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
  `
}

async function clearFailedMigrationRows(prisma) {
  if (!(await tableExists(prisma, '_prisma_migrations'))) return
  await prisma.$executeRaw`
    DELETE FROM "_prisma_migrations"
    WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
  `
}

async function baselineExistingSchema(prisma) {
  const rows = await readMigrationRows(prisma)
  const names = rows.map(r => r.migration_name)

  const initApplied = rows.some(
    r => r.migration_name === INIT_MIGRATION && r.finished_at != null && r.rolled_back_at == null,
  )
  if (initApplied) {
    console.log(`[prisma] Baseline "${INIT_MIGRATION}" già registrata (${names.length} migrazioni).`)
    return false
  }

  const schemaExists = await schemaLikelyExists(prisma)
  if (!schemaExists) {
    console.log('[prisma] DB vuoto — migrate deploy applicherà la baseline.')
    return false
  }

  const legacyCount = names.filter(n => n !== INIT_MIGRATION).length
  console.log(
    `[prisma] Schema già presente (${legacyCount} legacy, ${names.length} totali) → baseline "${INIT_MIGRATION}".`,
  )

  await clearFailedMigrationRows(prisma)
  if (names.length > 0) {
    await prisma.$executeRaw`DELETE FROM "_prisma_migrations"`
  }

  run(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`)
  return true
}

function deployMigrations() {
  run('npx prisma migrate deploy')
}

async function main() {
  run('npx prisma generate')

  const prisma = new PrismaClient({
    datasources: { db: { url: migrationDatabaseUrl() } },
  })

  try {
    await baselineExistingSchema(prisma)
  } finally {
    await prisma.$disconnect()
  }

  try {
    deployMigrations()
  } catch (firstError) {
    console.warn('[prisma] migrate deploy fallito — tentativo recovery baseline…')
    console.warn(firstError?.message ?? firstError)

    const prismaRetry = new PrismaClient({
      datasources: { db: { url: migrationDatabaseUrl() } },
    })
    try {
      const baselined = await baselineExistingSchema(prismaRetry)
      if (!baselined && !(await schemaLikelyExists(prismaRetry))) {
        throw firstError
      }
    } finally {
      await prismaRetry.$disconnect()
    }

    deployMigrations()
  }

  console.log('[prisma] Migrazioni completate.')
}

main().catch(err => {
  console.error('[prisma] migrate-production failed:', err)
  process.exit(1)
})
