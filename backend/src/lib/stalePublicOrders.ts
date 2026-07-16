import { prisma } from './prisma'
import { cancelAbandonedGuestOrder } from './abandonedGuestCheckout'

const PUBLIC_PENDING_TTL_MS = 60 * 60 * 1000 // 1h

/**
 * Annulla ordini PENDING abbandonati:
 * - senza Stripe session e senza cameriere (guest pay-at-table)
 * - oppure con Stripe session/claim ma ancora PENDING oltre TTL (checkout abbandonato)
 */
export async function cancelStalePublicPendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - PUBLIC_PENDING_TTL_MS)
  const stale = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      waiterId: null,
      createdAt: { lt: cutoff },
      OR: [
        { stripeSessionId: null },
        { stripeSessionId: { startsWith: 'pending_' } },
        { stripeSessionId: { not: null }, paidAt: null },
      ],
    },
    select: { id: true, stripeSessionId: true },
    take: 50,
  })

  let cancelled = 0
  for (const row of stale) {
    // Skip if Stripe session might still be open and young — only cancel clearly abandoned.
    // All rows here already passed TTL on createdAt.
    const result = await cancelAbandonedGuestOrder(row.id)
    if (result) cancelled++
  }
  return cancelled
}
