-- Fatturazione elettronica SaaS + idempotenza webhook Stripe

CREATE TYPE "StripeWebhookStatus" AS ENUM ('processing', 'succeeded', 'failed');
CREATE TYPE "SaasElectronicInvoiceStatus" AS ENUM ('pending', 'sent', 'failed');

ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "status" "StripeWebhookStatus" NOT NULL DEFAULT 'processing',
    "restaurantId" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasElectronicInvoice" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT,
    "stripeInvoiceId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeEventId" TEXT,
    "status" "SaasElectronicInvoiceStatus" NOT NULL DEFAULT 'pending',
    "fiscalRegime" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "vatNumber" TEXT NOT NULL,
    "sdiRecipientCode" TEXT,
    "pec" TEXT,
    "billingAddress" JSONB NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "vatNature" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "arubaUploadFileName" TEXT,
    "arubaErrorCode" TEXT,
    "arubaErrorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasElectronicInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "StripeWebhookEvent"("stripeEventId");
CREATE INDEX "StripeWebhookEvent_type_createdAt_idx" ON "StripeWebhookEvent"("type", "createdAt");
CREATE INDEX "StripeWebhookEvent_restaurantId_idx" ON "StripeWebhookEvent"("restaurantId");

CREATE UNIQUE INDEX "SaasElectronicInvoice_stripeInvoiceId_key" ON "SaasElectronicInvoice"("stripeInvoiceId");
CREATE INDEX "SaasElectronicInvoice_restaurantId_createdAt_idx" ON "SaasElectronicInvoice"("restaurantId", "createdAt");
CREATE INDEX "SaasElectronicInvoice_status_idx" ON "SaasElectronicInvoice"("status");

ALTER TABLE "StripeWebhookEvent" ADD CONSTRAINT "StripeWebhookEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaasElectronicInvoice" ADD CONSTRAINT "SaasElectronicInvoice_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
