-- FiscalClosure: giorno calendario unico + breakdown pagamenti + indici Order
ALTER TABLE "FiscalClosure" ADD COLUMN IF NOT EXISTS "calendarDay" TEXT;
UPDATE "FiscalClosure"
SET "calendarDay" = to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "calendarDay" IS NULL;
ALTER TABLE "FiscalClosure" ALTER COLUMN "calendarDay" SET NOT NULL;

ALTER TABLE "FiscalClosure" ADD COLUMN IF NOT EXISTS "totalStripe" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FiscalClosure" ADD COLUMN IF NOT EXISTS "totalDigital" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FiscalClosure" ADD COLUMN IF NOT EXISTS "totalVoucher" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "FiscalClosure_restaurantId_calendarDay_key"
  ON "FiscalClosure"("restaurantId", "calendarDay");

CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_paidAt_idx"
  ON "Order"("restaurantId", "status", "paidAt");

CREATE INDEX IF NOT EXISTS "Order_restaurantId_createdAt_idx"
  ON "Order"("restaurantId", "createdAt");
