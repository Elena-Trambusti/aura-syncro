import { api } from '../api'
import type { PaymentResult } from './aura-bridge'
import { isAndroidTablet } from './aura-bridge'

const STORAGE_KEY = 'aura-native-pos-checkout'

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

export function storePendingNativeCheckout(data: PendingNativeCheckout): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function readPendingNativeCheckout(orderId: string): PendingNativeCheckout | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PendingNativeCheckout
    return data.orderId === orderId ? data : null
  } catch {
    return null
  }
}

export function clearPendingNativeCheckout(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export async function completePendingNativeCheckout(
  result: PaymentResult,
): Promise<unknown | null> {
  if (result.status !== 'ok' || !result.orderId) {
    clearPendingNativeCheckout()
    return null
  }

  const pending = readPendingNativeCheckout(result.orderId)
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
      new CustomEvent('aura-native-checkout-finalized', { detail: response.data }),
    )
    return response.data
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent('aura-native-checkout-failed', { detail: { orderId: result.orderId, error } }),
    )
    throw error
  }
}
