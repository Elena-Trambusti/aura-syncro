-- Integrazione POS per-ristorante (configurazione concierge post-setup)

CREATE TYPE "PosIntegrationMode" AS ENUM ('PENDING_SETUP', 'SIMULATION', 'STRIPE_TERMINAL', 'EXTERNAL');

ALTER TABLE "RestaurantSettings" ADD COLUMN "posIntegrationMode" "PosIntegrationMode" NOT NULL DEFAULT 'PENDING_SETUP';
ALTER TABLE "RestaurantSettings" ADD COLUMN "posProviderLabel" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "posTerminalId" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "posMerchantId" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "posSetupNotes" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "posConfiguredAt" TIMESTAMP(3);
