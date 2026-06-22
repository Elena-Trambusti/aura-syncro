-- CreateEnum
CREATE TYPE "FiscalRegion" AS ENUM ('ITALIA', 'SPAGNA_PENINSULA', 'ISOLE_CANARIE');

-- AlterTable RestaurantSettings
ALTER TABLE "RestaurantSettings" ADD COLUMN "fiscalRegion" "FiscalRegion" NOT NULL DEFAULT 'ITALIA';

UPDATE "RestaurantSettings" SET "fiscalRegion" = CASE
  WHEN "taxRegion" = 'ES_CANARIAS' THEN 'ISOLE_CANARIE'::"FiscalRegion"
  WHEN "taxRegion" = 'ES_PENINSULA' THEN 'SPAGNA_PENINSULA'::"FiscalRegion"
  ELSE 'ITALIA'::"FiscalRegion"
END;

-- AlterTable MenuItem
ALTER TABLE "MenuItem" ADD COLUMN "taxRate" DOUBLE PRECISION;

-- AlterTable Order — snapshot immutabile alla chiusura
ALTER TABLE "Order" ADD COLUMN "fiscalRegionSnapshot" "FiscalRegion";
ALTER TABLE "Order" ADD COLUMN "fiscalIntegrityHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "fiscalPrevHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "fiscalClosedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_fiscalIntegrityHash_key" ON "Order"("fiscalIntegrityHash");

-- FiscalChainState
CREATE TABLE "FiscalChainState" (
    "restaurantId" TEXT NOT NULL,
    "lastHash" TEXT NOT NULL DEFAULT 'GENESIS',
    "lastOrderId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalChainState_pkey" PRIMARY KEY ("restaurantId")
);

ALTER TABLE "FiscalChainState" ADD CONSTRAINT "FiscalChainState_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
