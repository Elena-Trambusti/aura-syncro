import type { QueryClient } from '@tanstack/react-query'
import { tq } from './queryKeys'

export interface CachedInventoryItem {
  id: string
  name: string
  quantity: number
  minQuantity?: number
  cost?: number
  unit?: string
  category?: string
  [key: string]: unknown
}

export interface InventoryCacheData {
  items: CachedInventoryItem[]
  alerts: CachedInventoryItem[]
}

function inventoryKey(tenantKey: string | undefined) {
  if (!tenantKey) return null
  return tq(tenantKey, 'inventory')
}

function recomputeAlerts(items: CachedInventoryItem[]): CachedInventoryItem[] {
  return items.filter(i => i.quantity <= (i.minQuantity ?? 0))
}

export function snapshotInventory(
  queryClient: QueryClient,
  tenantKey: string | undefined,
): InventoryCacheData | undefined {
  const key = inventoryKey(tenantKey)
  if (!key) return undefined
  return queryClient.getQueryData<InventoryCacheData>(key)
}

export function adjustInventoryQty(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  id: string,
  delta: number,
): InventoryCacheData | undefined {
  const key = inventoryKey(tenantKey)
  const previous = key ? queryClient.getQueryData<InventoryCacheData>(key) : undefined
  if (!key || !previous) return previous

  const items = previous.items.map(i =>
    i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i,
  )
  queryClient.setQueryData<InventoryCacheData>(key, {
    items,
    alerts: recomputeAlerts(items),
  })
  return previous
}

export function removeInventoryItem(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  id: string,
): InventoryCacheData | undefined {
  const key = inventoryKey(tenantKey)
  const previous = key ? queryClient.getQueryData<InventoryCacheData>(key) : undefined
  if (!key || !previous) return previous

  const items = previous.items.filter(i => i.id !== id)
  queryClient.setQueryData<InventoryCacheData>(key, {
    items,
    alerts: recomputeAlerts(items),
  })
  return previous
}

export function restoreInventory(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  snapshot: InventoryCacheData | undefined,
) {
  const key = inventoryKey(tenantKey)
  if (key && snapshot) queryClient.setQueryData(key, snapshot)
}
