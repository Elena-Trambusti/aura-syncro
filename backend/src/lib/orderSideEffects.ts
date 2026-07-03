import { io } from '../index'
import { prisma } from './prisma'
import { applyDiscountToOrder } from './orderDiscount'
import { kitchenTicketsAfterOrderAttempt } from './kitchenEmitGuard'
import { broadcastNewOrderNotification, formatOrderCurrency } from './orderNotifications'
import { moneyNumber } from './money'

const orderDetailInclude = {
  table: true,
  waiter: { select: { id: true, name: true } },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
      loyaltyTier: { select: { name: true, discountPct: true, color: true } },
    },
  },
  items: {
    include: { menuItem: { include: { category: true } }, modifiers: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const

export type OrderCommitEffectsInput = {
  restaurantId: string
  orderId: string
  kind: 'created' | 'updated'
  tableId?: string | null
  applyDiscount?: boolean
  orderType?: string
  orderTotal?: number
  newItems?: unknown[]
}

/** Socket, sconti fedeltà e notifiche — fuori dal percorso critico HTTP. */
export function scheduleOrderCommitEffects(input: OrderCommitEffectsInput): void {
  void runOrderCommitEffects(input).catch(err => {
    console.error('[orderSideEffects]', err)
  })
}

async function runOrderCommitEffects(input: OrderCommitEffectsInput): Promise<void> {
  const {
    restaurantId,
    orderId,
    kind,
    tableId,
    applyDiscount,
    orderType,
    orderTotal,
    newItems,
  } = input

  if (applyDiscount) {
    await applyDiscountToOrder(orderId, restaurantId, { applyLoyalty: true })
  }

  const fullOrder = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: orderDetailInclude,
  })
  if (!fullOrder) return

  if (kind === 'created') {
    if (tableId) {
      const table = await prisma.table.findFirst({ where: { id: tableId, restaurantId } })
      if (table) io.to(restaurantId).emit('table:updated', table)
    }

    io.to(restaurantId).emit('order:created', fullOrder)
    for (const ticket of kitchenTicketsAfterOrderAttempt(fullOrder)) {
      io.to(restaurantId).emit('print:kitchen', { type: 'kitchen', order: ticket })
    }

    const tableLabel = fullOrder.table
      ? `tavolo ${fullOrder.table.number}`
      : (orderType ?? fullOrder.type).toLowerCase()
    const total = orderTotal ?? moneyNumber(fullOrder.total)
    void broadcastNewOrderNotification(
      restaurantId,
      orderId,
      `Nuovo ordine da ${tableLabel} — ${formatOrderCurrency(total)}`,
    )
  } else {
    io.to(restaurantId).emit('order:updated', fullOrder)
    io.to(restaurantId).emit('print:kitchen', {
      type: 'kitchen',
      order: fullOrder,
      ...(newItems?.length ? { newItems } : {}),
    })
  }
}
