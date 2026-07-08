import type { QueryClient } from '@tanstack/react-query'

export interface CachedOrderListItem {
  id: string
  status: string
  total?: number
  [key: string]: unknown
}

/** Patch status su tutte le query ordini del tenant (active, today, filter). */
export function patchOrderStatusInCaches(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  orderId: string,
  status: string,
): Map<readonly unknown[], CachedOrderListItem[] | undefined> {
  const snapshots = new Map<readonly unknown[], CachedOrderListItem[] | undefined>()
  if (!tenantKey) return snapshots

  const entries = queryClient.getQueriesData<CachedOrderListItem[]>({
    queryKey: [tenantKey, 'orders'],
  })

  for (const [key, data] of entries) {
    if (!data) continue
    snapshots.set(key, data)
    queryClient.setQueryData<CachedOrderListItem[]>(
      key,
      data.map(o => (o.id === orderId ? { ...o, status } : o)),
    )
  }

  return snapshots
}

export function restoreOrderCaches(
  queryClient: QueryClient,
  snapshots: Map<readonly unknown[], CachedOrderListItem[] | undefined>,
) {
  for (const [key, data] of snapshots) {
    if (data) queryClient.setQueryData(key, data)
  }
}

export function removeOrderFromCaches(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  orderId: string,
): Map<readonly unknown[], CachedOrderListItem[] | undefined> {
  const snapshots = new Map<readonly unknown[], CachedOrderListItem[] | undefined>()
  if (!tenantKey) return snapshots

  const entries = queryClient.getQueriesData<CachedOrderListItem[]>({
    queryKey: [tenantKey, 'orders'],
  })

  for (const [key, data] of entries) {
    if (!data) continue
    snapshots.set(key, data)
    queryClient.setQueryData<CachedOrderListItem[]>(
      key,
      data.filter(o => o.id !== orderId),
    )
  }

  return snapshots
}
