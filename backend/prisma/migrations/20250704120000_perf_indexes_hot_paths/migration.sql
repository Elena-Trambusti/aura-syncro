-- Hot-path indexes: floor plan tables query, predictive AI order items, reservation lookup per table
CREATE INDEX IF NOT EXISTS "Table_restaurantId_idx" ON "Table"("restaurantId");
CREATE INDEX IF NOT EXISTS "Order_tableId_status_idx" ON "Order"("tableId", "status");
CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_createdAt_idx" ON "OrderItem"("menuItemId", "createdAt");
CREATE INDEX IF NOT EXISTS "Reservation_tableId_date_status_idx" ON "Reservation"("tableId", "date", "status");
