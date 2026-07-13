-- Indici per aggregazioni dashboard/CRM e conteggio low-stock magazzino
CREATE INDEX IF NOT EXISTS "Customer_restaurantId_idx" ON "Customer"("restaurantId");
CREATE INDEX IF NOT EXISTS "InventoryItem_restaurantId_idx" ON "InventoryItem"("restaurantId");
