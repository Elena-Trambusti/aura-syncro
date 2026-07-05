-- Supabase RLS hardening — Aura Syncro (backend Prisma-only, no client Supabase JS)
-- Esegui: npm run db:supabase-rls (o SQL Editor Supabase)
-- Prisma/postgres (superuser) bypassa RLS; anon/authenticated non accedono alle tabelle.

BEGIN;

-- 1) Abilita RLS su tutte le tabelle public (risolve Security Advisor "RLS Disabled in Public")
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- 2) Blocca accesso PostgREST via chiavi anon/authenticated (l'app usa solo API backend)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- 3) Default per tabelle/funzioni future
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;

-- Verifica (opzionale): tabelle public senza RLS dovrebbero essere 0
-- SELECT tablename FROM pg_tables t
-- JOIN pg_class c ON c.relname = t.tablename
-- WHERE t.schemaname = 'public' AND c.relrowsecurity = false;
