ALTER TABLE "MenuItem"
  ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "MenuItem_restaurantId_archived_idx"
  ON "MenuItem"("restaurantId", "archived");
