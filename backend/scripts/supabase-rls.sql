-- Supabase RLS hardening for Aura Syncro (Prisma-only backend)
-- Run once on Supabase SQL editor when using Supabase Postgres.
-- Prisma connects with the service role / direct connection and bypasses RLS.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Revoke public API access via anon/authenticated roles (Prisma uses direct URL)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
