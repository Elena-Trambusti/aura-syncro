-- CRM & Marketing Automation module
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Customer"
SET
  "firstName" = COALESCE(NULLIF(split_part("name", ' ', 1), ''), "name"),
  "lastName" = COALESCE(NULLIF(trim(substring("name" from position(' ' in "name") + 1)), ''), '')
WHERE ("firstName" = '' OR "firstName" IS NULL) AND "name" IS NOT NULL;

CREATE TYPE "AutomationType" AS ENUM ('BIRTHDAY', 'WIN_BACK', 'VIP_THANKS');

CREATE TABLE IF NOT EXISTS "MarketingAutomation" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "type" "AutomationType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "messageTemplate" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingAutomation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingAutomation_restaurantId_type_key"
  ON "MarketingAutomation"("restaurantId", "type");

ALTER TABLE "MarketingAutomation"
  ADD CONSTRAINT "MarketingAutomation_restaurantId_fkey"
  FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
