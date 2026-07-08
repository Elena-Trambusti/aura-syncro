import type { QueryClient } from '@tanstack/react-query'
import { tq } from './queryKeys'

export interface CachedMenuItem {
  id: string
  name: string
  available?: boolean
  price?: number
  [key: string]: unknown
}

export interface CachedCategory {
  id: string
  name: string
  items: CachedMenuItem[]
}

function menuKey(tenantKey: string | undefined) {
  if (!tenantKey) return null
  return tq(tenantKey, 'menu', 'categories')
}

export function snapshotMenuCategories(
  queryClient: QueryClient,
  tenantKey: string | undefined,
): CachedCategory[] | undefined {
  const key = menuKey(tenantKey)
  if (!key) return undefined
  return queryClient.getQueryData<CachedCategory[]>(key)
}

export function patchMenuItemAvailability(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  itemId: string,
  available: boolean,
): CachedCategory[] | undefined {
  const key = menuKey(tenantKey)
  const previous = key ? queryClient.getQueryData<CachedCategory[]>(key) : undefined
  if (!key || !previous) return previous

  queryClient.setQueryData<CachedCategory[]>(
    key,
    previous.map(cat => ({
      ...cat,
      items: cat.items.map(item =>
        item.id === itemId ? { ...item, available } : item,
      ),
    })),
  )
  return previous
}

export function removeMenuItem(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  itemId: string,
): CachedCategory[] | undefined {
  const key = menuKey(tenantKey)
  const previous = key ? queryClient.getQueryData<CachedCategory[]>(key) : undefined
  if (!key || !previous) return previous

  queryClient.setQueryData<CachedCategory[]>(
    key,
    previous.map(cat => ({
      ...cat,
      items: cat.items.filter(item => item.id !== itemId),
    })),
  )
  return previous
}

export function restoreMenuCategories(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  snapshot: CachedCategory[] | undefined,
) {
  const key = menuKey(tenantKey)
  if (key && snapshot) queryClient.setQueryData(key, snapshot)
}
