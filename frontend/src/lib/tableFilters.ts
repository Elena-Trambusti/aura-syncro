import { findActiveTableOrder } from './orderSession'

export type TableQuickFilter = 'ALL' | 'FREE' | 'OCCUPIED' | 'BILL' | 'RESERVED'

const BILL_ORDER_STATUSES = new Set(['READY', 'SERVED'])

type TableWithOrders = {
  status: string
  orders?: Array<{ status: string; items?: Array<{ status: string }> }>
}

/** Tavolo con conto aperto / in attesa di pagamento. */
export function isTableBillStage(table: TableWithOrders): boolean {
  if (table.status !== 'OCCUPIED') return false
  const order = findActiveTableOrder(table.orders)
  return order != null && BILL_ORDER_STATUSES.has(order.status)
}

export function matchesTableQuickFilter(table: TableWithOrders, filter: TableQuickFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'FREE') return table.status === 'FREE'
  if (filter === 'RESERVED') return table.status === 'RESERVED'
  if (filter === 'BILL') return isTableBillStage(table)
  if (filter === 'OCCUPIED') return table.status === 'OCCUPIED' && !isTableBillStage(table)
  return true
}

/** Stima se i tap target sulla piantina sarebbero troppo piccoli → forza lista. */
export function shouldForceListView(containerWidth: number, tableCount: number): boolean {
  if (tableCount === 0) return false
  const fitScale = Math.max(0.15, (containerWidth - 24) / 1400)
  const minHitPx = 104 * fitScale
  if (minHitPx < 44) return true
  if (containerWidth < 380 && tableCount > 8) return true
  return false
}
