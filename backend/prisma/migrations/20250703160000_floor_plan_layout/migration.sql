-- prisma-migrate-disable-transaction
-- AlterEnum (must run outside a transaction on PostgreSQL)
ALTER TYPE "TableShape" ADD VALUE IF NOT EXISTS 'BAR_STOOL';
ALTER TYPE "TableShape" ADD VALUE IF NOT EXISTS 'BOOTH';

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "floorPlanLayout" JSONB;
