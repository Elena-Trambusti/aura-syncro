import webpush from 'web-push'
import { prisma } from './prisma'

export interface PushPayload {
  title: string
  body: string
  url?: string
  orderId?: string
  tag?: string
}

let vapidConfigured = false

function configureVapid(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@aura-syncro.app'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null
}

export async function sendPushToRestaurant(restaurantId: string, payload: PushPayload): Promise<void> {
  if (!configureVapid()) return

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { restaurantId },
  })
  if (subscriptions.length === 0) return

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/dashboard/orders',
    orderId: payload.orderId,
    tag: payload.tag ?? (payload.orderId ? `order-${payload.orderId}` : 'aura-syncro'),
  })

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    }),
  )
}

export async function notifyNewOrder(
  restaurantId: string,
  message: string,
  orderId: string,
): Promise<void> {
  await sendPushToRestaurant(restaurantId, {
    title: 'Nuovo ordine',
    body: message,
    url: '/dashboard/orders',
    orderId,
    tag: `order-${orderId}`,
  })
}
