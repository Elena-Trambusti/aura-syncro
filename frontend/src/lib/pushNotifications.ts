import { api } from './api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied'
  return Notification.permission
}

export async function showNativeNotification(
  title: string,
  options: NotificationOptions & { url?: string; orderId?: string },
): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  const { url, orderId, ...rest } = options
  await reg.showNotification(title, {
    icon: '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    ...rest,
    data: { url: url ?? '/dashboard/orders', orderId, ...(rest.data as object | undefined) },
  } as NotificationOptions)
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const { data } = await api.get<{ publicKey: string | null }>('/push/vapid-public-key')
  if (!data.publicKey) {
    console.warn('[push] VAPID public key not configured on server')
    return false
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey) as BufferSource,
    })
  }

  await api.post('/push/subscribe', subscription.toJSON())
  return true
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await api.delete('/push/subscribe', { data: { endpoint: subscription.endpoint } })
  await subscription.unsubscribe()
}
