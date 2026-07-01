-- Audit remediation: refunds, labor rate, marketing dedup, inventory audit, onboarding concierge

ALTER TABLE "Order" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "RestaurantSettings" ADD COLUMN "laborHourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 12;
ALTER TABLE "RestaurantSettings" ADD COLUMN "legalCity" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "legalZip" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "legalProvince" TEXT;
ALTER TABLE "RestaurantSettings" ADD COLUMN "onboardingConcierge" JSONB;

CREATE TABLE "MarketingAutomationSend" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "automationType" "AutomationType" NOT NULL,
    "customerId" TEXT NOT NULL,
    "calendarDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingAutomationSend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingAutomationSend_restaurantId_automationType_customerId_calendarDay_key" ON "MarketingAutomationSend"("restaurantId", "automationType", "customerId", "calendarDay");
CREATE INDEX "MarketingAutomationSend_restaurantId_calendarDay_idx" ON "MarketingAutomationSend"("restaurantId", "calendarDay");

ALTER TABLE "MarketingAutomationSend" ADD CONSTRAINT "MarketingAutomationSend_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingAutomationSend" ADD CONSTRAINT "MarketingAutomationSend_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "userId" TEXT,
    "delta" DOUBLE PRECISION NOT NULL,
    "quantityBefore" DOUBLE PRECISION NOT NULL,
    "quantityAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryAdjustment_restaurantId_inventoryItemId_idx" ON "InventoryAdjustment"("restaurantId", "inventoryItemId");

ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
