/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'

declare let self: ServiceWorkerGlobalScope

const ORDERS_PATH = '/ordini'

/** Non precachare index.html: dopo un deploy i bundle hanno hash nuovi e la shell HTML stale causa pagina bianca. */
const precacheManifest = self.__WB_MANIFEST.filter(entry => {
  const url = typeof entry === 'string' ? entry : entry.url
  return url !== 'index.html' && !url.endsWith('/index.html')
})

precacheAndRoute(precacheManifest)
cleanupOutdatedCaches()

/** Shell HTML sempre da rete per primi, con fallback cache (offline). */
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'aura-documents',
      networkTimeoutSeconds: 5,
    }),
  ),
)

/** Background Sync per richieste API POST/PATCH di creazione/aggiornamento ordini */
const bgSyncPlugin = new BackgroundSyncPlugin('aura-offline-queue', {
  maxRetentionTime: 24 * 60, // Ritenta per un massimo di 24 ore
})

registerRoute(
  ({ request, url }) => url.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
)

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
  event.waitUntil(self.clients.claim())
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
    icon: `/pwa/maskable-192.png?v=16`,
    badge: `/pwa/maskable-192.png?v=16`,
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
