import { prisma } from './prisma'
import { cancelAbandonedGuestOrder } from './abandonedGuestCheckout'

const PUBLIC_PENDING_TTL_MS = 60 * 60 * 1000 // 1h

/**
 * Annulla ordini PENDING abbandonati senza Stripe session e senza cameriere
 * (tipicamente guest QR pay-at-table lasciati aperti).
 */
export async function cancelStalePublicPendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - PUBLIC_PENDING_TTL_MS)
  const stale = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      stripeSessionId: null,
      waiterId: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 50,
  })

  let cancelled = 0
  for (const row of stale) {
    const result = await cancelAbandonedGuestOrder(row.id)
    if (result) cancelled++
  }
  return cancelled
}
