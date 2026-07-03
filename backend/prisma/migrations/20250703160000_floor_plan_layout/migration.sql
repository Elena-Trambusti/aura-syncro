-- AlterEnum
ALTER TYPE "TableShape" ADD VALUE 'BAR_STOOL';
ALTER TYPE "TableShape" ADD VALUE 'BOOTH';

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "floorPlanLayout" JSONB;
