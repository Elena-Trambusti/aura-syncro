/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.skipWaiting()
clientsClaim()

interface PushPayload {
  title?: string
  body?: string
  url?: string
  orderId?: string
  tag?: string
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
    icon: '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    tag: payload.tag ?? 'aura-syncro',
    data: {
      url: payload.url ?? '/dashboard/orders',
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
    (event.notification.data?.url as string | undefined) ?? '/dashboard',
    self.location.origin,
  ).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
