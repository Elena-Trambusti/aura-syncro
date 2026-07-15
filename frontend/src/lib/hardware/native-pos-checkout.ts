import { get, set, del } from 'idb-keyval'
import { api } from '../api'
import type { PaymentResult } from './aura-bridge'
import { isAndroidTablet } from './aura-bridge'

const SESSION_KEY = 'aura-native-pos-checkout'
const LOCAL_KEY = 'aura-native-pos-checkout-backup'
const IDB_KEY = 'aura-native-pos-checkout'

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
  void set(IDB_KEY, data).catch(() => {
    /* ignore */
  })
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

async function readPendingFromIdb(orderId: string): Promise<PendingNativeCheckout | null> {
  try {
    const data = await get<PendingNativeCheckout>(IDB_KEY)
    if (data?.orderId === orderId && data.payload && typeof data.payload === 'object') {
      // Ripristina nelle storage sync per letture successive.
      writePendingStorage(data)
      return data
    }
  } catch {
    /* ignore */
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
  void del(IDB_KEY).catch(() => {
    /* ignore */
  })
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

/**
 * Recupero sicuro: non inventa tip/importo.
 * Se manca il payload salvato, restituisce null (attach failure toast).
 * Tentativo IndexedDB solo per payload completo già persistito.
 */
export async function recoverPendingNativeCheckout(
  orderId: string,
): Promise<PendingNativeCheckout | null> {
  const fromSync = readPendingFromStorage(orderId)
  if (fromSync?.payload && typeof fromSync.payload === 'object') {
    return fromSync
  }

  const fromIdb = await readPendingFromIdb(orderId)
  if (fromIdb) return fromIdb

  // Nessun payload completo: non finalizzare con dati inventati.
  try {
    const { data } = await api.get<{ order: { status: string } }>(`/payments/checkout/${orderId}`)
    if (data.order.status === 'PAID') return null
  } catch {
    /* ignore */
  }
  return null
}

export async function completePendingNativeCheckout(
  result: PaymentResult,
  options?: { recovered?: boolean },
): Promise<unknown | null> {
  if (result.status !== 'ok' || !result.orderId) {
    abortPendingNativeCheckout(result.orderId)
    return null
  }

  const terminalRef = resolveNativePosTerminalRef(result)
  if (!terminalRef) {
    // EXTERNAL finalize requires a terminal reference — do not invent one.
    return null
  }

  let pending = readPendingNativeCheckout(result.orderId)
  let recovered = options?.recovered ?? false

  if (!pending) {
    pending = await recoverPendingNativeCheckout(result.orderId)
    recovered = Boolean(pending) && (options?.recovered ?? true)
  }

  if (!pending?.payload || typeof pending.payload !== 'object') {
    return null
  }

  const suffix =
    pending.splitGuestIndex != null ? `:split:${pending.splitGuestIndex}` : ''
  const headers = pending.idempotencyKey
    ? { 'X-Idempotency-Key': `${pending.idempotencyKey}${suffix}` }
    : undefined

  const finalizePayload = {
    ...pending.payload,
    nativePosConfirmed: true,
    nativePosTerminalRef: terminalRef,
  }

  try {
    const response = await api.post('/payments/finalize', finalizePayload, {
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

/** Prefer txId / transactionId / receiptId / reference from the native bridge. */
export function resolveNativePosTerminalRef(result: PaymentResult): string | null {
  const candidates = [result.txId, result.transactionId, result.receiptId, result.reference]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export type NativePaymentOutcome = 'finalized' | 'cancelled' | 'ignored' | 'missing_terminal_ref'

/** Esito pagamento POS nativo → finalize backend o reset UI checkout. */
export async function handleNativePaymentResult(
  result: PaymentResult,
): Promise<NativePaymentOutcome> {
  if (result.status === 'ok') {
    if (!resolveNativePosTerminalRef(result)) {
      return 'missing_terminal_ref'
    }
    const data = await completePendingNativeCheckout(result)
    return data ? 'finalized' : 'ignored'
  }
  abortPendingNativeCheckout(result.orderId)
  return 'cancelled'
}
