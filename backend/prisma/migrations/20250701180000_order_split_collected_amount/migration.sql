-- Split conto: incasso parziale cumulativo prima della chiusura fiscale PAID
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "collectedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "splitPaidGuestIndexes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
