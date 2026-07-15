import { prisma } from './prisma'
import { restoreInventoryForOrderItem } from './inventoryDeduction'
import { releaseTableIfSessionComplete } from './orderSession'

export type CancelledGuestOrderInfo = {
  restaurantId: string
  orderId: string
  tableId: string | null
}

/** Annulla ordine guest Stripe non pagato e ripristina stock/tavolo (atomico vs PAID). */
export async function cancelAbandonedGuestOrder(orderId: string): Promise<CancelledGuestOrderInfo | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true, status: true } } },
  })
  if (!order || order.status === 'PAID' || order.status === 'CANCELLED') return null

  const cancelled = await prisma.$transaction(async tx => {
    const updated = await tx.order.updateMany({
      where: {
        id: orderId,
        status: { notIn: ['PAID', 'CANCELLED'] },
      },
      data: { status: 'CANCELLED' },
    })
    if (updated.count === 0) return null

    await tx.orderItem.updateMany({
      where: { orderId, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED' },
    })
    for (const item of order.items) {
      await restoreInventoryForOrderItem(tx, item.id, order.restaurantId)
    }
    return true
  })

  if (!cancelled) return null

  await releaseTableIfSessionComplete(order.tableId)

  return {
    restaurantId: order.restaurantId,
    orderId: order.id,
    tableId: order.tableId,
  }
}
