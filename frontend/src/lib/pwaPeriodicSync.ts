const PERIODIC_SYNC_TAG = 'aura-content-refresh'
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000

type PeriodicSyncManager = {
  register: (tag: string, options?: { minInterval?: number }) => Promise<void>
}

type PeriodicCapableRegistration = ServiceWorkerRegistration & {
  periodicSync?: PeriodicSyncManager
}

/** Registra Periodic Background Sync (Chrome Android) — refresh manifest/cache. */
export async function registerPwaPeriodicSync(
  registration?: ServiceWorkerRegistration,
): Promise<void> {
  if (typeof window === 'undefined' || !import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  const reg = (registration ?? (await navigator.serviceWorker.getRegistration())) as
    | PeriodicCapableRegistration
    | undefined
  if (!reg?.periodicSync) return

  try {
    await reg.periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: MIN_INTERVAL_MS })
  } catch {
    /* permesso negato o API non disponibile */
  }
}

export { PERIODIC_SYNC_TAG }
