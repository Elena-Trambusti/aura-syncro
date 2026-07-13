/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin, Queue } from 'workbox-background-sync'

declare let self: ServiceWorkerGlobalScope

const ORDERS_PATH = '/ordini'
const OFFLINE_QUEUE_NAME = 'aura-offline-queue'
const PERIODIC_SYNC_TAG = 'aura-content-refresh'

/** Non precachare index.html: dopo un deploy i bundle hanno hash nuovi e la shell HTML stale causa pagina bianca. */
const precacheManifest = self.__WB_MANIFEST.filter(entry => {
  const url = typeof entry === 'string' ? entry : entry.url
  return url !== 'index.html' && !url.endsWith('/index.html')
})

precacheAndRoute(precacheManifest)
cleanupOutdatedCaches()

/** Shell HTML: sempre rete quando online; cache solo se offline (evita HTML stale → schermo nero). */
registerRoute(
  new NavigationRoute(async ({ request }) => {
    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open('aura-nav-offline-v2')
        void cache.put(request, response.clone())
      }
      return response
    } catch {
      const cache = await caches.open('aura-nav-offline-v2')
      const cached = await cache.match(request)
      if (cached) return cached
      const fallback = await cache.match('/index.html')
      if (fallback) return fallback
      return Response.error()
    }
  }),
)

/** Background Sync per richieste API POST/PATCH di creazione/aggiornamento ordini */
const orderOfflineQueue = new Queue(OFFLINE_QUEUE_NAME, {
  maxRetentionTime: 24 * 60,
})
const bgSyncPlugin = new BackgroundSyncPlugin(OFFLINE_QUEUE_NAME, {
  maxRetentionTime: 24 * 60,
})

registerRoute(
  ({ request, url }) => url.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
)

/** Background Sync esplicito — allineato a Workbox queue (PWABuilder + retry ordini offline) */
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEvent
  const tag = syncEvent.tag
  if (tag === OFFLINE_QUEUE_NAME || tag.startsWith('workbox-background-sync')) {
    syncEvent.waitUntil(orderOfflineQueue.replayRequests())
  }
})

/** Periodic Sync — refresh manifest e shell navigazione in cache */
self.addEventListener('periodicsync', (event: Event) => {
  const periodicEvent = event as Event & { tag: string; waitUntil: (p: Promise<void>) => void }
  if (periodicEvent.tag !== PERIODIC_SYNC_TAG) return
  periodicEvent.waitUntil(
    (async () => {
      const manifestRes = await fetch('/manifest.json', { cache: 'no-store' })
      if (manifestRes.ok) {
        const cache = await caches.open('aura-manifest-v1')
        await cache.put('/manifest.json', manifestRes)
      }
      try {
        const navRes = await fetch('/login?pwa=1', { cache: 'no-store' })
        if (navRes.ok) {
          const navCache = await caches.open('aura-nav-offline-v2')
          await navCache.put('/login?pwa=1', navRes)
        }
      } catch {
        /* offline */
      }
    })(),
  )
})

/** autoUpdate: attiva subito il nuovo worker senza chiedere conferma */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key === 'aura-syncro-cache-v1' || key === 'aura-nav-offline-v1')
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  )
})

interface PushPayload {
  title?: string
  body?: string
  url?: string
  orderId?: string
  tag?: string
}

async function focusOrOpenClient(targetUrl: string): Promise<WindowClient | null> {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const raw of clientList) {
    const client = raw as WindowClient
    if (!client.url.startsWith(self.location.origin)) continue
    if (typeof client.navigate === 'function') {
      try {
        return await client.navigate(targetUrl)
      } catch {
        await client.focus()
        return client
      }
    }
    await client.focus()
    return client
  }
  return self.clients.openWindow(targetUrl)
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }

  const title = payload.title ?? 'Aura Syncro'
  const options = {
    body: payload.body ?? '',
    icon: `/pwa/maskable-192.png?v=19`,
    badge: `/pwa/maskable-192.png?v=19`,
    tag: payload.tag ?? 'aura-syncro',
    data: {
      url: payload.url ?? ORDERS_PATH,
      orderId: payload.orderId,
    },
    vibrate: [180, 80, 180],
    requireInteraction: payload.orderId != null,
  } as NotificationOptions

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = new URL(
    (event.notification.data?.url as string | undefined) ?? ORDERS_PATH,
    self.location.origin,
  ).href

  event.waitUntil(focusOrOpenClient(targetUrl))
})
