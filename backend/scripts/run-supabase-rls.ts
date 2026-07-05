/**
 * Applica hardening RLS su Supabase (PostgREST anon/authenticated bloccati).
 * Uso: npm run db:supabase-rls
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config()

const directUrl = process.env.DIRECT_URL
if (!directUrl) {
  console.error('DIRECT_URL mancante in backend/.env')
  process.exit(1)
}

const sqlFile = path.join(process.cwd(), 'scripts', 'supabase-rls.sql')
execSync(`npx prisma db execute --file "${sqlFile}" --url "${directUrl}"`, {
  stdio: 'inherit',
})

console.log('RLS Supabase applicato.')
