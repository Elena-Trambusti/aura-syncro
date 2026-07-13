import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Elimina un tenant e tutti i dati collegati (ordine FK-safe).
 */
export async function deleteRestaurantCascade(db: Db, restaurantId: string): Promise<void> {
  await db.cashTransaction.deleteMany({
    where: { session: { restaurantId } },
  })
  await db.cashRegisterSession.deleteMany({ where: { restaurantId } })
  await db.pushSubscription.deleteMany({ where: { restaurantId } })
  await db.loyaltyTransaction.deleteMany({ where: { restaurantId } })
  await db.orderItemModifier.deleteMany({
    where: { orderItem: { order: { restaurantId } } },
  })
  await db.orderItem.deleteMany({ where: { order: { restaurantId } } })
  await db.inventoryAdjustment.deleteMany({
    where: { inventoryItem: { restaurantId } },
  })
  await db.shift.deleteMany({ where: { user: { restaurantId } } })
  await db.order.updateMany({
    where: { restaurantId },
    data: { waiterId: null, tipWaiterId: null, customerId: null },
  })
  await db.reservation.updateMany({
    where: { restaurantId },
    data: { customerId: null },
  })
  await db.waitlistEntry.deleteMany({ where: { restaurantId } })
  await db.reservation.deleteMany({ where: { restaurantId } })
  await db.customer.deleteMany({ where: { restaurantId } })
  await db.loyaltyTier.deleteMany({ where: { restaurantId } })
  await db.order.deleteMany({ where: { restaurantId } })
  await db.menuModifierOption.deleteMany({
    where: { group: { menuItem: { restaurantId } } },
  })
  await db.menuModifierGroup.deleteMany({
    where: { menuItem: { restaurantId } },
  })
  await db.menuItem.deleteMany({ where: { restaurantId } })
  await db.menuCategory.deleteMany({ where: { restaurantId } })
  await db.table.deleteMany({ where: { restaurantId } })
  await db.inventoryItemLink.deleteMany({
    where: { inventoryItem: { restaurantId } },
  })
  await db.inventoryItem.deleteMany({ where: { restaurantId } })
  await db.marketingAutomation.deleteMany({ where: { restaurantId } })
  await db.campaign.deleteMany({ where: { restaurantId } })
  await db.invoice.deleteMany({ where: { restaurantId } })
  await db.fiscalClosure.deleteMany({ where: { restaurantId } })
  await db.fiscalSequence.deleteMany({ where: { restaurantId } })
  await db.fiscalChainState.deleteMany({ where: { restaurantId } })
  await db.saasElectronicInvoice.deleteMany({ where: { restaurantId } })
  await db.stripeWebhookEvent.updateMany({
    where: { restaurantId },
    data: { restaurantId: null },
  })
  await db.apiIdempotencyRecord.deleteMany({ where: { restaurantId } })
  await db.user.deleteMany({ where: { restaurantId } })
  await db.restaurantSettings.deleteMany({ where: { restaurantId } })
  await db.restaurant.delete({ where: { id: restaurantId } })
}
