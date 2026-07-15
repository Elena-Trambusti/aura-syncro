import type { QueryClient } from '@tanstack/react-query'
import { tq } from './queryKeys'

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'

export interface CachedOrderRow {
  id: string
  status: string
  total: number
  subtotal?: number
  tax?: number
  items?: unknown[]
  createdAt?: string
  [key: string]: unknown
}

export interface CachedTableRow {
  id: string
  number: number
  status: TableStatus
  orders?: CachedOrderRow[]
  reservations?: unknown[]
  [key: string]: unknown
}

export type TableSocketPatch = {
  id: string
  status?: TableStatus
  number?: number
  orders?: CachedOrderRow[]
}

function tablesKey(tenantKey: string | undefined) {
  if (!tenantKey) return null
  return tq(tenantKey, 'tables')
}

export function snapshotTablesCache(
  queryClient: QueryClient,
  tenantKey: string | undefined,
): CachedTableRow[] | undefined {
  const key = tablesKey(tenantKey)
  if (!key) return undefined
  return queryClient.getQueryData<CachedTableRow[]>(key)
}

export function restoreTablesCache(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  snapshot: CachedTableRow[] | undefined,
) {
  const key = tablesKey(tenantKey)
  if (snapshot && key) {
    queryClient.setQueryData(key, snapshot)
  }
}

function writeTables(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  next: CachedTableRow[],
) {
  const key = tablesKey(tenantKey)
  if (!key) return
  queryClient.setQueryData(key, next)
}

/** Segna il tavolo come "da pulire" subito dopo l'incasso. */
export function markTableCleaningAfterPayment(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  orderId: string,
): CachedTableRow[] | undefined {
  const previous = snapshotTablesCache(queryClient, tenantKey)
  if (!previous?.length) return undefined

  let changed = false
  const next = previous.map(table => {
    const hasOrder = table.orders?.some(o => o.id === orderId)
    if (!hasOrder) return table
    changed = true
    return {
      ...table,
      status: 'CLEANING' as const,
      orders: [],
    }
  })

  if (!changed) return undefined
  writeTables(queryClient, tenantKey, next)
  return previous
}

/** Tavolo occupato con ordine (nuova comanda o socket). */
export function markTableOccupiedWithOrder(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  tableId: string,
  order: CachedOrderRow,
): CachedTableRow[] | undefined {
  const previous = snapshotTablesCache(queryClient, tenantKey)
  if (!previous?.length) return undefined

  const next = previous.map(table => {
    if (table.id !== tableId) return table
    const existing = table.orders ?? []
    const withoutDup = existing.filter(o => o.id !== order.id)
    return {
      ...table,
      status: 'OCCUPIED' as const,
      orders: [order, ...withoutDup],
    }
  })

  writeTables(queryClient, tenantKey, next)
  return previous
}

/** Aggiorna totale ordine attivo sul tavolo (aggiunta piatti). */
export function bumpTableOrderTotals(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  tableId: string,
  orderId: string,
  addedTotal: number,
): CachedTableRow[] | undefined {
  const previous = snapshotTablesCache(queryClient, tenantKey)
  if (!previous?.length) return undefined

  let changed = false
  const next = previous.map(table => {
    if (table.id !== tableId) return table
    const orders = table.orders?.map(o => {
      if (o.id !== orderId) return o
      changed = true
      const total = (o.total ?? 0) + addedTotal
      return { ...o, total }
    })
    return orders ? { ...table, orders } : table
  })

  if (changed) writeTables(queryClient, tenantKey, next)
  return previous
}

/** Tavolo libero (post-pulizia). */
export function markTableFreeInCache(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  tableId: string,
): CachedTableRow[] | undefined {
  const previous = snapshotTablesCache(queryClient, tenantKey)
  if (!patchTableInQueryCache(queryClient, tenantKey, { id: tableId, status: 'FREE', orders: [] })) {
    return previous
  }
  return previous
}

/** Trasferimento ordine tra tavoli (UI ottimistica). */
export function applyTableTransferOptimistic(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  sourceTableId: string,
  targetTableId: string,
): CachedTableRow[] | undefined {
  const previous = snapshotTablesCache(queryClient, tenantKey)
  if (!previous?.length) return undefined

  const source = previous.find(t => t.id === sourceTableId)
  const order = source?.orders?.[0]
  if (!order) return previous

  const next = previous.map(table => {
    if (table.id === sourceTableId) {
      return { ...table, status: 'CLEANING' as const, orders: [] }
    }
    if (table.id === targetTableId) {
      return { ...table, status: 'OCCUPIED' as const, orders: [order] }
    }
    return table
  })

  writeTables(queryClient, tenantKey, next)
  return previous
}

/** Prenotazione → seduta: tavolo occupato senza ordine ancora. */
export function markTableSeatedFromReservation(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  tableId: string,
): CachedTableRow[] | undefined {
  const previous = snapshotTablesCache(queryClient, tenantKey)
  if (!patchTableInQueryCache(queryClient, tenantKey, {
    id: tableId,
    status: 'OCCUPIED',
    orders: [],
  })) {
    return previous
  }
  return previous
}

/** Applica evento socket `table:updated` senza refetch. */
export function patchTableInQueryCache(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  patch: TableSocketPatch,
): boolean {
  if (!patch.id) return false

  const previous = snapshotTablesCache(queryClient, tenantKey)
  if (!previous?.length) return false

  const index = previous.findIndex(t => t.id === patch.id)
  if (index < 0) return false

  const current = previous[index]
  const nextRow: CachedTableRow = {
    ...current,
    ...(patch.number != null ? { number: patch.number } : {}),
    ...(patch.status ? { status: patch.status } : {}),
  }

  if (patch.orders !== undefined) {
    nextRow.orders = patch.orders
  } else if (patch.status === 'CLEANING' || patch.status === 'FREE') {
    nextRow.orders = []
  }

  const next = [...previous]
  next[index] = nextRow
  writeTables(queryClient, tenantKey, next)
  return true
}

/** Aggiorna tavolo da evento ordine (created/updated). */
export function patchTableFromOrderEvent(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  order: {
    id: string
    tableId?: string | null
    table?: { id?: string; number?: number } | null
    status: string
    total?: number
    subtotal?: number
    tax?: number
    items?: unknown[]
    createdAt?: string
  },
): boolean {
  const tableId = order.tableId ?? order.table?.id
  if (!tableId) return false

  if (order.status === 'PAID' || order.status === 'CANCELLED') {
    // false → caller must invalidate; don't claim patched when cache had no matching order
    return markTableCleaningAfterPayment(queryClient, tenantKey, order.id) != null
  }

  return markTableOccupiedWithOrder(queryClient, tenantKey, tableId, {
    id: order.id,
    status: order.status,
    total: order.total ?? 0,
    subtotal: order.subtotal,
    tax: order.tax,
    items: order.items,
    createdAt: order.createdAt,
  }) != null
}
