/**
 * Migrazioni produzione (DigitalOcean start + CI).
 * - Connessione DIRECT_URL (no pooler)
 * - Baseline DB legacy senza rieseguire SQL
 * - Fallback manuale se `migrate resolve` fallisce
 */
import { execSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const INIT_MIGRATION = '20250620000000_init'

function logStep(msg) {
  console.log(`[prisma] ${msg}`)
}

function migrationDatabaseUrl() {
  const direct = process.env.DIRECT_URL?.trim()
  const pooled = process.env.DATABASE_URL?.trim()
  if (!direct && !pooled) {
    throw new Error('DATABASE_URL mancante — impossibile eseguire migrazioni')
  }
  if (!direct) {
    logStep('WARN: DIRECT_URL non impostato — uso DATABASE_URL (migrate può fallire con PgBouncer).')
  }
  return direct || pooled
}

function migrationEnv() {
  const url = migrationDatabaseUrl()
  return { ...process.env, DATABASE_URL: url, DIRECT_URL: url }
}

function run(cmd) {
  logStep(`$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env: migrationEnv() })
}

function runCapture(cmd) {
  logStep(`$ ${cmd}`)
  return execSync(cmd, { encoding: 'utf8', env: migrationEnv() })
}

function migrationChecksum() {
  const path = join(process.cwd(), 'prisma/migrations', INIT_MIGRATION, 'migration.sql')
  if (!existsSync(path)) {
    throw new Error(`File migrazione baseline non trovato: ${path}`)
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function createPrisma() {
  return new PrismaClient({
    datasources: { db: { url: migrationDatabaseUrl() } },
  })
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

async function markInitAppliedManual(prisma) {
  const checksum = migrationChecksum()
  const id = randomUUID()
  logStep(`Inserimento manuale baseline (checksum ${checksum.slice(0, 12)}…)`)
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations" (
      id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
    ) VALUES (
      ${id}, ${checksum}, NOW(), ${INIT_MIGRATION}, NULL, NULL, NOW(), 1
    )
  `
}

async function markInitApplied(prisma) {
  try {
    run(`npx prisma migrate resolve --applied ${INIT_MIGRATION}`)
  } catch (err) {
    logStep(`migrate resolve fallito: ${err?.message ?? err}`)
    await markInitAppliedManual(prisma)
  }
}

async function baselineExistingSchema(prisma) {
  const rows = await readMigrationRows(prisma)
  const names = rows.map(r => r.migration_name)

  const initApplied = rows.some(
    r => r.migration_name === INIT_MIGRATION && r.finished_at != null && r.rolled_back_at == null,
  )
  if (initApplied) {
    logStep(`Baseline "${INIT_MIGRATION}" già registrata (${names.length} migrazioni).`)
    return false
  }

  const schemaExists = await schemaLikelyExists(prisma)
  if (!schemaExists) {
    logStep('DB vuoto — migrate deploy applicherà la baseline.')
    return false
  }

  const legacyCount = names.filter(n => n !== INIT_MIGRATION).length
  logStep(
    `Schema già presente (${legacyCount} legacy, ${names.length} totali) → baseline "${INIT_MIGRATION}".`,
  )

  await clearFailedMigrationRows(prisma)
  if (names.length > 0) {
    await prisma.$executeRaw`DELETE FROM "_prisma_migrations"`
  }

  await markInitApplied(prisma)
  return true
}

function deployMigrations() {
  run('npx prisma migrate deploy')
}

async function main() {
  logStep(`cwd=${process.cwd()}`)
  logStep(`node=${process.version}`)
  logStep(`DIRECT_URL=${Boolean(process.env.DIRECT_URL?.trim())} DATABASE_URL=${Boolean(process.env.DATABASE_URL?.trim())}`)

  if (!existsSync(join(process.cwd(), 'prisma/migrations', INIT_MIGRATION, 'migration.sql'))) {
    throw new Error('Baseline migration assente nel container — rebuild necessario')
  }

  // Sempre generate: directory presente ≠ client allineato allo schema (CI/deploy).
  run('npx prisma generate')

  const statusBefore = runCapture('npx prisma migrate status || true')
  logStep(`migrate status (before):\n${statusBefore}`)

  const prisma = createPrisma()
  try {
    await baselineExistingSchema(prisma)
  } finally {
    await prisma.$disconnect()
  }

  try {
    deployMigrations()
  } catch (firstError) {
    logStep('migrate deploy fallito — recovery baseline…')
    logStep(String(firstError?.message ?? firstError))

    const prismaRetry = createPrisma()
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

  const statusAfter = runCapture('npx prisma migrate status || true')
  logStep(`migrate status (after):\n${statusAfter}`)
  logStep('Migrazioni completate.')
}

main().catch(err => {
  console.error('[prisma] migrate-production failed:', err)
  process.exit(1)
})
