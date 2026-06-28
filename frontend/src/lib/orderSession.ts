/** Item di cucina considerati conclusi (allineato a backend orderSession). */
export const KITCHEN_DONE_ITEM_STATUSES = new Set(['SERVED', 'CANCELLED'])

/**
 * Ordine che mantiene aperta la sessione al tavolo (conto o cucina non chiusi).
 * Stessa logica di backend activeTableOrderWhere / countActiveTableOrders.
 */
export function isActiveTableOrder(order: {
  status: string
  items?: Array<{ status: string }>
}): boolean {
  if (order.status === 'CANCELLED') return false
  if (order.status !== 'PAID') return true
  return order.items?.some(i => !KITCHEN_DONE_ITEM_STATUSES.has(i.status)) ?? false
}

/** Primo ordine attivo sul tavolo (più recente se l'API li ordina per createdAt desc). */
export function findActiveTableOrder<T extends { status: string; items?: Array<{ status: string }> }>(
  orders: T[] | undefined | null,
): T | undefined {
  return orders?.find(isActiveTableOrder)
}
