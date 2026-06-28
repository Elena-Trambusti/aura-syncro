import type { StripeCheckoutSessionPayload } from './stripeTypes'
import { cancelAbandonedGuestOrder } from './abandonedGuestCheckout'
import { io } from '../index'
import { prisma } from './prisma'

const orderInclude = {
  table: true,
  items: { include: { menuItem: { include: { category: true } } } },
}

/** Annulla ordini guest Stripe non completati (checkout scaduto). */
export async function handleCheckoutSessionExpired(
  session: StripeCheckoutSessionPayload,
): Promise<void> {
  const orderId = session.metadata?.orderId
  if (!orderId) return

  const cancelled = await cancelAbandonedGuestOrder(orderId)
  if (!cancelled) return

  console.info('[stripe-webhook] Ordine guest annullato (checkout scaduto):', orderId)

  const order = await prisma.order.findUnique({
    where: { id: cancelled.orderId },
    include: orderInclude,
  })
  if (order) {
    io.to(cancelled.restaurantId).emit('order:updated', order)
  }

  if (cancelled.tableId) {
    const table = await prisma.table.findUnique({ where: { id: cancelled.tableId } })
    if (table) {
      io.to(cancelled.restaurantId).emit('table:updated', table)
    }
  }
}
