export interface KitchenOrderItem {
  id: string
  menuItem: { name: string; preparationTime?: number }
  quantity: number
  status: string
  notes?: string
}

export interface KitchenOrder {
  id: string
  status: string
  type: string
  createdAt: string
  table?: { number: number }
  items: KitchenOrderItem[]
  notes?: string
}

export const KITCHEN_HIDDEN_ITEM_STATUSES = new Set(['SERVED', 'CANCELLED'])

export const ITEM_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-400',
  PREPARING: 'bg-orange-400',
  READY: 'bg-emerald-400',
  SERVED: 'bg-slate-400',
}

export function nextItemStatus(status: string): string | null {
  if (status === 'PENDING') return 'PREPARING'
  if (status === 'PREPARING') return 'READY'
  return null
}

export function itemActionKey(orderId: string, itemId: string, status: string, units?: number): string {
  return `${orderId}:${itemId}:${status}:${units ?? 'all'}`
}

export function orderActionKey(orderId: string, action: 'ready' | 'dismiss'): string {
  return `${orderId}:${action}`
}

/** Allinea lo stato ordine agli item (stessa logica del backend syncOrderStatusFromItems). */
export function computeOrderStatusFromItems(items: KitchenOrderItem[]): string {
  const active = items.filter(i => i.status !== 'CANCELLED')
  if (active.length === 0) return 'PENDING'
  if (active.every(i => i.status === 'SERVED')) return 'SERVED'
  if (active.every(i => ['READY', 'SERVED'].includes(i.status))) return 'READY'
  if (active.some(i => ['PREPARING', 'READY', 'SERVED'].includes(i.status))) return 'PREPARING'
  return 'PENDING'
}

export function orderNeedsKitchenAttention(order: KitchenOrder): boolean {
  if (order.status === 'CANCELLED' || order.status === 'SERVED') return false
  return order.items.some(i => !KITCHEN_HIDDEN_ITEM_STATUSES.has(i.status))
}

export function filterKitchenOrders(orders: KitchenOrder[]): KitchenOrder[] {
  return orders.filter(orderNeedsKitchenAttention)
}

export function mergeKitchenOrder(orders: KitchenOrder[], updated: KitchenOrder): KitchenOrder[] {
  const merged = orders.map(o => (o.id === updated.id ? updated : o))
  if (!orders.some(o => o.id === updated.id)) {
    merged.unshift(updated)
  }
  return filterKitchenOrders(merged)
}

export function applyOptimisticItemStatus(
  orders: KitchenOrder[],
  orderId: string,
  itemId: string,
  targetStatus: string,
  units?: number,
): KitchenOrder[] {
  const next = orders.map(order => {
    if (order.id !== orderId) return order

    const items = [...order.items]
    const idx = items.findIndex(i => i.id === itemId)
    if (idx === -1) return order

    const item = items[idx]
    const splitReady =
      targetStatus === 'READY' &&
      item.quantity > 1 &&
      (units ?? 1) < item.quantity

    if (splitReady) {
      const n = units ?? 1
      items[idx] = { ...item, quantity: item.quantity - n }
      items.push({
        ...item,
        id: `optimistic-${itemId}-${n}-${Date.now()}`,
        quantity: n,
        status: 'READY',
      })
    } else {
      items[idx] = { ...item, status: targetStatus }
    }

    return {
      ...order,
      items,
      status: computeOrderStatusFromItems(items),
    }
  })

  return filterKitchenOrders(next)
}

export function applyOptimisticOrderReady(orders: KitchenOrder[], orderId: string): KitchenOrder[] {
  const next = orders.map(order => {
    if (order.id !== orderId) return order
    const items = order.items.map(item =>
      KITCHEN_HIDDEN_ITEM_STATUSES.has(item.status) || item.status === 'READY'
        ? item
        : { ...item, status: 'READY' },
    )
    return { ...order, items, status: 'READY' }
  })
  return filterKitchenOrders(next)
}

export function applyOptimisticDismiss(orders: KitchenOrder[], orderId: string): KitchenOrder[] {
  return orders.filter(o => o.id !== orderId)
}
