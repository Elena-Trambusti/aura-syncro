import { prisma } from './prisma'
import { restoreInventoryForOrderItem } from './inventoryDeduction'
import { releaseTableIfSessionComplete } from './orderSession'

/** Annulla ordine guest Stripe non pagato e ripristina stock/tavolo. */
export async function cancelAbandonedGuestOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { id: true, status: true } } },
  })
  if (!order || order.status === 'PAID' || order.status === 'CANCELLED') return false

  await prisma.$transaction(async tx => {
    await tx.orderItem.updateMany({
      where: { orderId, status: { not: 'CANCELLED' } },
      data: { status: 'CANCELLED' },
    })
    for (const item of order.items) {
      await restoreInventoryForOrderItem(tx, item.id, order.restaurantId)
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    })
  })

  await releaseTableIfSessionComplete(order.tableId)
  return true
}
