import { api, getApiBaseUrl } from './api'

export class PushSubscribeError extends Error {
  code: 'unsupported' | 'denied' | 'no_vapid' | 'invalid_vapid' | 'no_sw' | 'subscribe_failed' | 'server_error'

  constructor(
    message: string,
    code: PushSubscribeError['code'],
  ) {
    super(message)
    this.name = 'PushSubscribeError'
    this.code = code
  }
}

/** Normalizza la chiave VAPID dal server (trim, rimuove virgolette accidentalmente incluse nel .env) */
export function normalizeVapidPublicKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/^["']|["']$/g, '')
  return trimmed.length > 0 ? trimmed : null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function validateVapidPublicKey(key: string): Uint8Array {
  let bytes: Uint8Array
  try {
    bytes = urlBase64ToUint8Array(key)
  } catch {
    throw new PushSubscribeError(
      'Chiave VAPID pubblica non valida (formato base64url errato)',
      'invalid_vapid',
    )
  }
  if (bytes.length !== 65) {
    throw new PushSubscribeError(
      `Chiave VAPID pubblica non valida (attesi 65 byte, ricevuti ${bytes.length})`,
      'invalid_vapid',
    )
  }
  return bytes
}

function applicationServerKeysMatch(
  existing: ArrayBuffer | null | undefined,
  expected: Uint8Array,
): boolean {
  if (!existing) return false
  const a = new Uint8Array(existing)
  if (a.length !== expected.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== expected[i]) return false
  }
  return true
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied'
  return Notification.permission
}

/** Attende il Service Worker con timeout (evita hang silenzioso) */
export async function waitForServiceWorker(timeoutMs = 20_000): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new PushSubscribeError('Service Worker non supportato', 'no_sw')
  }

  const existing = await navigator.serviceWorker.getRegistration()
  if (existing?.active) return existing

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      setTimeout(() => {
        reject(new PushSubscribeError(
          'Service Worker non attivo. Ricarica la pagina e riprova (serve HTTPS o localhost).',
          'no_sw',
        ))
      }, timeoutMs)
    }),
  ])
}

/** Recupera la chiave VAPID dal backend — endpoint pubblico, senza JWT */
export async function fetchVapidPublicKey(): Promise<string> {
  const url = `${getApiBaseUrl()}/push/vapid-public-key`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new PushSubscribeError(
      `Impossibile ottenere la chiave VAPID dal server (HTTP ${res.status})`,
      'server_error',
    )
  }
  const data = await res.json() as { publicKey?: unknown }
  const key = normalizeVapidPublicKey(data.publicKey)
  if (!key) {
    throw new PushSubscribeError(
      'VAPID_PUBLIC_KEY non configurata sul backend. Aggiungila al .env e riavvia il server.',
      'no_vapid',
    )
  }
  return key
}

export async function showNativeNotification(
  title: string,
  options: NotificationOptions & { url?: string; orderId?: string },
): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return
  const reg = await waitForServiceWorker()
  const { url, orderId, ...rest } = options
  await reg.showNotification(title, {
    icon: '/pwa/maskable-192.png',
    badge: '/pwa/maskable-192.png',
    ...rest,
    data: { url: url ?? '/dashboard/orders', orderId, ...(rest.data as object | undefined) },
  } as NotificationOptions)
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) {
    throw new PushSubscribeError('Push non supportato da questo browser', 'unsupported')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushSubscribeError('Permesso notifiche negato', 'denied')
  }

  const publicKey = await fetchVapidPublicKey()
  const applicationServerKey = validateVapidPublicKey(publicKey)

  const registration = await waitForServiceWorker()
  let subscription = await registration.pushManager.getSubscription()

  const existingKey = subscription?.options?.applicationServerKey ?? null
  if (subscription && !applicationServerKeysMatch(existingKey, applicationServerKey)) {
    console.info('[push] Chiave VAPID cambiata — nuova subscribe')
    await subscription.unsubscribe()
    subscription = null
  }

  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[push] pushManager.subscribe failed:', err)
      throw new PushSubscribeError(
        `Subscribe push fallita: ${msg}. Verifica che VAPID_PUBLIC_KEY nel backend corrisponda alla coppia generata.`,
        'subscribe_failed',
      )
    }
  }

  const payload = subscription.toJSON()
  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    throw new PushSubscribeError('Subscription browser incompleta', 'subscribe_failed')
  }

  try {
    await api.post('/push/subscribe', {
      endpoint: payload.endpoint,
      keys: {
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth,
      },
    })
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number; data?: { error?: string } } }).response?.status
    const serverMsg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
    throw new PushSubscribeError(
      serverMsg ?? `Salvataggio subscription fallito (HTTP ${status ?? '?'})`,
      'server_error',
    )
  }

  console.info('[push] Subscription attiva, endpoint:', payload.endpoint.slice(0, 48) + '…')
  return true
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await waitForServiceWorker()
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await api.delete('/push/subscribe', { data: { endpoint: subscription.endpoint } })
  await subscription.unsubscribe()
}
