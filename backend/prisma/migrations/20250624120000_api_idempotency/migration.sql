-- CreateTable
CREATE TABLE "ApiIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiIdempotencyRecord_restaurantId_key_key" ON "ApiIdempotencyRecord"("restaurantId", "key");

-- CreateIndex
CREATE INDEX "ApiIdempotencyRecord_createdAt_idx" ON "ApiIdempotencyRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "ApiIdempotencyRecord" ADD CONSTRAINT "ApiIdempotencyRecord_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
