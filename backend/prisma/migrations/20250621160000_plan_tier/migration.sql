-- Piano moduli BASE / PRO su RestaurantSettings
CREATE TYPE "PlanTier" AS ENUM ('BASE', 'PRO');

ALTER TABLE "RestaurantSettings" ADD COLUMN "planTier" "PlanTier" NOT NULL DEFAULT 'BASE';
