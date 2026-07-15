import { api } from '../api'
import { moneyNumber } from '../money'
import type { PaymentResult } from './aura-bridge'
import { isAndroidTablet } from './aura-bridge'

const SESSION_KEY = 'aura-native-pos-checkout'
const LOCAL_KEY = 'aura-native-pos-checkout-backup'

export interface PendingNativeCheckout {
  orderId: string
  payload: Record<string, unknown>
  splitGuestIndex?: number
  amountEuro: number
  idempotencyKey: string
}

export function shouldUseNativePos(posMode?: string): boolean {
  return isAndroidTablet() && posMode === 'EXTERNAL'
}

function writePendingStorage(data: PendingNativeCheckout): void {
  const raw = JSON.stringify(data)
  try {
    sessionStorage.setItem(SESSION_KEY, raw)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LOCAL_KEY, raw)
  } catch {
    /* ignore */
  }
}

function readPendingFromStorage(orderId: string): PendingNativeCheckout | null {
  const keys: Array<{ store: Storage; key: string }> = [
    { store: sessionStorage, key: SESSION_KEY },
    { store: localStorage, key: LOCAL_KEY },
  ]

  for (const { store, key } of keys) {
    try {
      const raw = store.getItem(key)
      if (!raw) continue
      const data = JSON.parse(raw) as PendingNativeCheckout
      if (data.orderId === orderId) return data
    } catch {
      /* try next store */
    }
  }
  return null
}

function clearPendingStorage(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LOCAL_KEY)
  } catch {
    /* ignore */
  }
}

export function storePendingNativeCheckout(data: PendingNativeCheckout): void {
  writePendingStorage({
    ...data,
    payload: {
      ...data.payload,
      nativePosConfirmed: true,
    },
  })
}

export function readPendingNativeCheckout(orderId: string): PendingNativeCheckout | null {
  return readPendingFromStorage(orderId)
}

export function clearPendingNativeCheckout(): void {
  clearPendingStorage()
}

export function abortPendingNativeCheckout(orderId?: string): void {
  const pending = orderId ? readPendingNativeCheckout(orderId) : null
  clearPendingNativeCheckout()
  window.dispatchEvent(
    new CustomEvent('aura-native-checkout-cancelled', {
      detail: { orderId: orderId ?? pending?.orderId ?? null },
    }),
  )
}

/** Ricostruisce payload minimo se sessionStorage/localStorage persi dopo pagamento POS. */
export async function recoverPendingNativeCheckout(
  orderId: string,
): Promise<PendingNativeCheckout | null> {
  try {
    const { data } = await api.get<{
      order: { status: string; total: number }
    }>(`/payments/checkout/${orderId}`)
    const order = data.order
    if (order.status === 'PAID') return null

    return {
      orderId,
      payload: {
        orderId,
        paymentMethod: 'CARD',
        tipAmount: 0,
        nativePosConfirmed: true,
      },
      amountEuro: moneyNumber(order.total),
      idempotencyKey: `checkout-finalize:${orderId}`,
    }
  } catch {
    return null
  }
}

export async function completePendingNativeCheckout(
  result: PaymentResult,
  options?: { recovered?: boolean },
): Promise<unknown | null> {
  if (result.status !== 'ok' || !result.orderId) {
    abortPendingNativeCheckout(result.orderId)
    return null
  }

  let pending = readPendingNativeCheckout(result.orderId)
  let recovered = options?.recovered ?? false

  if (!pending) {
    pending = await recoverPendingNativeCheckout(result.orderId)
    recovered = Boolean(pending)
  }

  if (!pending) return null

  const suffix =
    pending.splitGuestIndex != null ? `:split:${pending.splitGuestIndex}` : ''
  const headers = pending.idempotencyKey
    ? { 'X-Idempotency-Key': `${pending.idempotencyKey}${suffix}` }
    : undefined

  try {
    const response = await api.post('/payments/finalize', pending.payload, {
      timeout: 20000,
      headers,
    })
    clearPendingNativeCheckout()
    window.dispatchEvent(
      new CustomEvent('aura-native-checkout-finalized', {
        detail: { ...response.data, recovered },
      }),
    )
    return response.data
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent('aura-native-checkout-failed', { detail: { orderId: result.orderId, error } }),
    )
    throw error
  }
}

export type NativePaymentOutcome = 'finalized' | 'cancelled' | 'ignored'

/** Esito pagamento POS nativo → finalize backend o reset UI checkout. */
export async function handleNativePaymentResult(
  result: PaymentResult,
): Promise<NativePaymentOutcome> {
  if (result.status === 'ok') {
    const data = await completePendingNativeCheckout(result)
    return data ? 'finalized' : 'ignored'
  }
  abortPendingNativeCheckout(result.orderId)
  return 'cancelled'
}
