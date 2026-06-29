-- Performance indexes for hot paths (tables/kitchen/reports + reservations calendar)
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "Reservation_restaurantId_date_idx" ON "Reservation"("restaurantId", "date");
