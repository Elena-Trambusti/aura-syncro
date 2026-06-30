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

const ACTIVE_SESSION_OR: Prisma.OrderWhereInput['OR'] = [
  { status: { notIn: ['PAID', 'CANCELLED'] } },
  {
    status: 'PAID',
    items: { some: { status: { notIn: ['SERVED', 'CANCELLED'] } } },
  },
]

/** Ordini che tengono aperta la sessione al tavolo (cucina o conto non chiusi). */
export function activeTableOrderWhere(
  tableId: string,
  restaurantId: string,
): Prisma.OrderWhereInput {
  return {
    tableId,
    restaurantId,
    OR: ACTIVE_SESSION_OR,
  }
}

/** Ordini attivi in sala per un ristorante (lista ordini / KPI operativi). */
export function restaurantActiveOrdersWhere(restaurantId: string): Prisma.OrderWhereInput {
  return {
    restaurantId,
    status: { notIn: ['CANCELLED'] },
    OR: ACTIVE_SESSION_OR,
  }
}

/**
 * Ordini visibili in cucina e lista "attivi" cameriere.
 * Esclude checkout Stripe non pagato (PENDING + stripeSessionId) — la cucina non deve preparare prima dell'incasso.
 */
export function kitchenActiveOrdersWhere(restaurantId: string): Prisma.OrderWhereInput {
  return {
    restaurantId,
    status: { notIn: ['CANCELLED'] },
    OR: ACTIVE_SESSION_OR,
    NOT: {
      status: 'PENDING',
      stripeSessionId: { not: null },
    },
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

  return markTableCleaningIfOccupied(tableId, table.status)
}

/**
 * Dopo incasso POS: il conto chiuso non blocca più il tavolo (ospiti usciti → pulizia),
 * anche se in cucina restano item non ancora marcati SERVED.
 */
export async function releaseTableAfterPayment(
  tableId: string | null | undefined,
  paidOrderId: string,
): Promise<Awaited<ReturnType<typeof prisma.table.update>> | null> {
  if (!tableId) return null

  const table = await prisma.table.findUnique({ where: { id: tableId } })
  if (!table) return null

  const otherActive = await prisma.order.count({
    where: {
      ...activeTableOrderWhere(tableId, table.restaurantId),
      id: { not: paidOrderId },
    },
  })
  if (otherActive > 0) return null

  return markTableCleaningIfOccupied(tableId, table.status)
}

/** Variante transazionale — usata nel fast-path di incasso POS. */
export async function releaseTableAfterPaymentTx(
  tx: Prisma.TransactionClient,
  tableId: string | null | undefined,
  restaurantId: string,
  paidOrderId: string,
): Promise<Awaited<ReturnType<typeof prisma.table.update>> | null> {
  if (!tableId) return null

  const table = await tx.table.findFirst({ where: { id: tableId, restaurantId } })
  if (!table) return null

  const otherActive = await tx.order.count({
    where: {
      ...activeTableOrderWhere(tableId, restaurantId),
      id: { not: paidOrderId },
    },
  })
  if (otherActive > 0) return null

  if (table.status === 'OCCUPIED' || table.status === 'RESERVED') {
    return tx.table.update({
      where: { id: tableId },
      data: { status: 'CLEANING' },
    })
  }
  return null
}

function markTableCleaningIfOccupied(
  tableId: string,
  status: string,
): Promise<Awaited<ReturnType<typeof prisma.table.update>> | null> {
  if (status === 'OCCUPIED' || status === 'RESERVED') {
    return prisma.table.update({
      where: { id: tableId },
      data: { status: 'CLEANING' },
    })
  }
  return Promise.resolve(null)
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

  if (table.status === 'OCCUPIED') {
    const updated = await tx.table.updateMany({
      where: { id: tableId, restaurantId, status: 'OCCUPIED' },
      data: { status: 'OCCUPIED' },
    })
    return updated.count > 0
  }

  return false
}

/**
 * Occupa tavolo dopo pagamento guest Stripe: l'ordine PAID appena creato conta già come sessione attiva,
 * quindi occupyTableIfAvailable fallirebbe. Esclude l'ordine corrente dal conteggio.
 */
export async function occupyTableForSessionOrder(
  tx: Prisma.TransactionClient,
  tableId: string,
  restaurantId: string,
  orderId: string,
): Promise<Awaited<ReturnType<typeof prisma.table.update>> | null> {
  const otherActive = await tx.order.count({
    where: {
      ...activeTableOrderWhere(tableId, restaurantId),
      id: { not: orderId },
    },
  })
  if (otherActive > 0) return null

  const table = await tx.table.findFirst({ where: { id: tableId, restaurantId } })
  if (!table || table.status === 'CLEANING') return null

  if (table.status === 'FREE' || table.status === 'RESERVED' || table.status === 'OCCUPIED') {
    return tx.table.update({
      where: { id: tableId },
      data: { status: 'OCCUPIED' },
    })
  }
  return null
}
