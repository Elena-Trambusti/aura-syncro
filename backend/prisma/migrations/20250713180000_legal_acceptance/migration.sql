-- Tracciamento accettazione Termini / DPA in registrazione (accountability GDPR)
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "dpaAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "dpaVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "legalAcceptIp" TEXT;
ALTER TABLE "User" ADD COLUMN "legalAcceptUserAgent" VARCHAR(512);
