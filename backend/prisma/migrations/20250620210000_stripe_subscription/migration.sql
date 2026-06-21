-- Abbonamento SaaS Stripe (Premium / freemium)
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "hasActiveSubscription" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
