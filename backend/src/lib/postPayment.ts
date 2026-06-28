import { prisma } from './prisma'
import { resolveRevenueAmount } from './fiscalAmounts'
import { earnLoyaltyPointsForOrder } from './loyaltyHelpers'

/** Aggiorna CRM e fedeltà dopo chiusura ordine PAID. Idempotente per stesso orderId. */
export async function applyPostPaymentEffects(orderId: string, restaurantId: string): Promise<void> {
  const orderFull = await prisma.order.findFirst({
    where: { id: orderId, restaurantId, status: 'PAID' },
    select: {
      id: true,
      customerId: true,
      revenueAmount: true,
      total: true,
      subtotal: true,
      tax: true,
      tipAmount: true,
      paidAt: true,
    },
  })
  if (!orderFull?.customerId) return

  const customerId = orderFull.customerId
  const order = orderFull

  const alreadyProcessed = await prisma.loyaltyTransaction.findFirst({
    where: { orderId: order.id, type: 'EARNED' },
    select: { id: true },
  })

  const revenue = resolveRevenueAmount(order)
  const paidAt = order.paidAt ?? new Date()

  if (!alreadyProcessed) {
    await prisma.customer.updateMany({
      where: { id: customerId, restaurantId },
      data: {
        totalVisits: { increment: 1 },
        totalSpent: { increment: revenue },
        lastVisit: paidAt,
      },
    })
  }

  await earnLoyaltyPointsForOrder(customerId, restaurantId, revenue, order.id)
}
