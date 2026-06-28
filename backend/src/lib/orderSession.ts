import type { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from './prisma'

export const KITCHEN_DONE_ITEM_STATUSES = new Set(['SERVED', 'CANCELLED'])

/** Stato operativo cucina derivato dagli item (non fiscale). */
export function computeOperationalStatusFromItems(
  items: Array<{ status: string }>,
): OrderStatus {
  const active = items.filter(i => i.status !== 'CANCELLED')
  if (active.length === 0) return 'CANCELLED'
  if (active.every(i => i.status === 'SERVED')) return 'SERVED'
  if (active.every(i => ['READY', 'SERVED'].includes(i.status))) return 'READY'
  if (active.some(i => ['PREPARING', 'READY', 'SERVED'].includes(i.status))) return 'PREPARING'
  return 'PENDING'
}

export function orderHasActiveKitchenItems(items: Array<{ status: string }>): boolean {
  return items.some(i => !KITCHEN_DONE_ITEM_STATUSES.has(i.status))
}

/** Ordini che tengono aperta la sessione al tavolo (cucina o conto non chiusi). */
export function activeTableOrderWhere(
  tableId: string,
  restaurantId: string,
): Prisma.OrderWhereInput {
  return {
    tableId,
    restaurantId,
    OR: [
      { status: { notIn: ['PAID', 'CANCELLED'] } },
      {
        status: 'PAID',
        items: { some: { status: { notIn: ['SERVED', 'CANCELLED'] } } },
      },
    ],
  }
}

export async function countActiveTableOrders(
  tableId: string,
  restaurantId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  return tx.order.count({
    where: activeTableOrderWhere(tableId, restaurantId),
  })
}

/**
 * Sincronizza lo stato operativo dagli item.
 * Gli ordini PAID restano PAID (chiusura fiscale) — la cucina segue gli item.
 */
export async function syncOrderStatusFromItemsTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  currentOrderStatus: string,
): Promise<void> {
  if (currentOrderStatus === 'CANCELLED') return

  const items = await tx.orderItem.findMany({ where: { orderId } })
  if (currentOrderStatus === 'PAID') return

  const operational = computeOperationalStatusFromItems(items)
  await tx.order.update({ where: { id: orderId }, data: { status: operational } })
}

/** Libera il tavolo solo quando nessun ordine ha cucina/conto aperti. */
export async function releaseTableIfSessionComplete(
  tableId: string | null | undefined,
): Promise<Awaited<ReturnType<typeof prisma.table.update>> | null> {
  if (!tableId) return null

  const table = await prisma.table.findUnique({ where: { id: tableId } })
  if (!table) return null

  const activeCount = await countActiveTableOrders(tableId, table.restaurantId)
  if (activeCount > 0) return null

  if (table.status === 'OCCUPIED' || table.status === 'RESERVED') {
    return prisma.table.update({
      where: { id: tableId },
      data: { status: 'CLEANING' },
    })
  }
  return null
}

/** Occupa tavolo in modo atomico se libero o già riservato. */
export async function occupyTableIfAvailable(
  tx: Prisma.TransactionClient,
  tableId: string,
  restaurantId: string,
): Promise<boolean> {
  const activeCount = await countActiveTableOrders(tableId, restaurantId, tx)
  if (activeCount > 0) return false

  const table = await tx.table.findFirst({ where: { id: tableId, restaurantId } })
  if (!table) return false
  if (table.status === 'CLEANING') return false

  if (table.status === 'FREE' || table.status === 'RESERVED') {
    const updated = await tx.table.updateMany({
      where: { id: tableId, restaurantId, status: { in: ['FREE', 'RESERVED'] } },
      data: { status: 'OCCUPIED' },
    })
    return updated.count > 0
  }

  return table.status === 'OCCUPIED'
}
