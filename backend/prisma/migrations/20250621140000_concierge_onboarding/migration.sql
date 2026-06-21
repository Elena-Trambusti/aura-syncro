-- Concierge onboarding: flag setup completato sul ristorante
ALTER TABLE "Restaurant" ADD COLUMN "isSetupComplete" BOOLEAN NOT NULL DEFAULT false;
