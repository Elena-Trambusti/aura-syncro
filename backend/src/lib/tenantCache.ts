/**
 * Cache in-memory per tenant — dati che cambiano raramente (predictive AI, layout).
 * TTL breve; invalidare su mutazioni critiche se necessario.
 */
interface CacheEntry {
  data: unknown
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

export function getTenantCache<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function setTenantCache(key: string, data: unknown, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function invalidateTenantCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

/** Evita crescita illimitata in processi long-running */
const MAX_ENTRIES = 500

export function setTenantCacheBounded(key: string, data: unknown, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest) store.delete(oldest)
  }
  setTenantCache(key, data, ttlMs)
}
