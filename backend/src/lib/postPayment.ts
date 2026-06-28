import { prisma } from './prisma'
import { earnLoyaltyPointsForOrder } from './loyaltyHelpers'

/** Aggiorna CRM e fedeltà dopo chiusura ordine PAID. Idempotente per stesso orderId. */
export async function applyPostPaymentEffects(orderId: string, restaurantId: string): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId, status: 'PAID' },
    select: {
      id: true,
      customerId: true,
      revenueAmount: true,
      total: true,
      paidAt: true,
    },
  })
  if (!order?.customerId) return

  const alreadyProcessed = await prisma.loyaltyTransaction.findFirst({
    where: { orderId: order.id, type: 'EARNED' },
    select: { id: true },
  })

  const revenue = order.revenueAmount > 0 ? order.revenueAmount : order.total
  const paidAt = order.paidAt ?? new Date()

  if (!alreadyProcessed) {
    await prisma.customer.update({
      where: { id: order.customerId },
      data: {
        totalVisits: { increment: 1 },
        totalSpent: { increment: revenue },
        lastVisit: paidAt,
      },
    })
  }

  await earnLoyaltyPointsForOrder(order.customerId, restaurantId, revenue, order.id)
}
