/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin, Queue } from 'workbox-background-sync'

declare let self: ServiceWorkerGlobalScope

const ORDERS_PATH = '/ordini'
const OFFLINE_QUEUE_NAME = 'aura-offline-queue'
const PERIODIC_SYNC_TAG = 'aura-content-refresh'
const NAV_CACHE = 'aura-nav-offline-v2'

function offlineShellResponse(): Response {
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#0B0E14" />
  <title>Aura Syncro — offline</title>
  <style>
    *{box-sizing:border-box;margin:0}
    body{min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0B0E14;color:#E8DFC7;font-family:system-ui,sans-serif;padding:1.5rem;text-align:center}
    .card{max-width:22rem;display:flex;flex-direction:column;gap:1rem;align-items:center}
    h1{font-size:1.125rem;font-weight:700;color:#F5ECD8}
    p{font-size:.875rem;color:#A89B7A;line-height:1.5}
    button{font:inherit;cursor:pointer;border:0;border-radius:.75rem;padding:.75rem 1rem;font-weight:600;background:#C9A227;color:#0B0E14}
    button.secondary{background:#12151C;color:#E8DFC7;border:1px solid rgba(255,255,255,.12)}
  </style>
</head>
<body>
  <div class="card">
    <h1>Connessione assente</h1>
    <p>Non riusciamo a raggiungere il server. Verifica Wi‑Fi o dati mobili e riprova.</p>
    <button type="button" onclick="location.replace('/login?pwa=1')">Riprova</button>
    <button type="button" class="secondary" onclick="location.reload()">Ricarica</button>
  </div>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/** Non precachare index.html: dopo un deploy i bundle hanno hash nuovi e la shell HTML stale causa pagina bianca. */
const precacheManifest = self.__WB_MANIFEST.filter(entry => {
  const url = typeof entry === 'string' ? entry : entry.url
  return url !== 'index.html' && !url.endsWith('/index.html')
})

precacheAndRoute(precacheManifest)
cleanupOutdatedCaches()

/** Shell HTML: rete con timeout; offline → cache o pagina di recupero (mai Response.error). */
registerRoute(
  new NavigationRoute(async ({ request }) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch(request, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (response.ok) {
        const cache = await caches.open(NAV_CACHE)
        void cache.put(request, response.clone())
      }
      return response
    } catch {
      clearTimeout(timeoutId)
      const cache = await caches.open(NAV_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const fallback = await cache.match('/index.html')
      if (fallback) return fallback
      return offlineShellResponse()
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
          const navCache = await caches.open(NAV_CACHE)
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
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key === 'aura-syncro-cache-v1' || key === 'aura-nav-offline-v1')
          .map((key) => caches.delete(key)),
      ),
    ),
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
