/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

const ORDERS_PATH = '/ordini'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

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
    icon: '/pwa/maskable-192.png',
    badge: '/pwa/maskable-192.png',
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
