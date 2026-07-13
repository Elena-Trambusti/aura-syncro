-- Table serving lock (sala)
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "servingUserId" TEXT;
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "servingUserName" TEXT;
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "servingClaimedAt" TIMESTAMP(3);

-- Print Agent pairing token
ALTER TABLE "RestaurantSettings" ADD COLUMN IF NOT EXISTS "printAgentToken" TEXT;

-- Audit trail
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_restaurantId_createdAt_idx" ON "AuditLog"("restaurantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_restaurantId_action_idx" ON "AuditLog"("restaurantId", "action");
