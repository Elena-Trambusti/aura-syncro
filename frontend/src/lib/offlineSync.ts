import type { AxiosError } from 'axios'
import toast from 'react-hot-toast'
import i18n from '../i18n'
import { api } from './api'
import {
  type AddOrderItemsPayload,
  type CreateOrderPayload,
  type OfflineMutation,
  type OrderLinePayload,
  createMutationId,
  enqueueMutation,
  listPendingMutations,
  removeMutation,
  updateMutationFailure,
  updateMutationPayload,
} from './offlineQueue'

export type SubmitResult = 'synced' | 'queued'

const listeners = new Set<() => void>()
let flushing = false
let flushTimer: ReturnType<typeof setInterval> | null = null
let onSyncedCallback: (() => void) | null = null
let initCount = 0

function handleOnlineEvent(): void {
  void flushOfflineQueue()
}

export function subscribeOfflineSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(): void {
  listeners.forEach(l => l())
}

export function isFlushingQueue(): boolean {
  return flushing
}

export function isRetryableNetworkError(err: unknown): boolean {
  const ax = err as AxiosError
  if (!ax || typeof ax !== 'object') return false
  if (!ax.response) return true
  if (ax.code === 'ECONNABORTED' || ax.code === 'ERR_NETWORK') return true
  const status = ax.response.status
  return status >= 502 && status <= 504
}

export function isPermanentClientError(err: unknown): boolean {
  const ax = err as AxiosError<{ code?: string }>
  if (!ax.response) return false
  const status = ax.response.status
  const code = ax.response.data?.code
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409) return true
  if (code === 'MENU_ITEM_SOLD_OUT' || code === 'MENU_ITEM_UNAVAILABLE' || code === 'TABLE_OCCUPIED') return true
  return false
}

async function postOrderItem(orderId: string, item: OrderLinePayload, itemKey: string): Promise<void> {
  await api.post(
    `/orders/${orderId}/items`,
    {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      course: item.course,
      modifiers: item.modifiers,
      notes: item.notes,
    },
    { headers: { 'X-Idempotency-Key': itemKey } },
  )
}

async function executeMutation(mutation: OfflineMutation): Promise<void> {
  const idempotencyHeader = (key: string) => ({ headers: { 'X-Idempotency-Key': key } })

  if (mutation.kind === 'CREATE_ORDER') {
    const payload = mutation.payload as CreateOrderPayload
    await api.post(
      '/orders',
      {
        tableId: payload.tableId,
        type: payload.type,
        customerId: payload.customerId,
        items: payload.items.map(i => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          course: i.course,
          modifiers: i.modifiers,
          notes: i.notes,
        })),
      },
      idempotencyHeader(mutation.id),
    )
    return
  }

  const payload = mutation.payload as AddOrderItemsPayload
  for (const item of payload.items) {
    const itemKey = `${mutation.id}:${item.menuItemId}`
    await postOrderItem(payload.orderId, item, itemKey)
  }
}

async function executeMutationPartial(mutation: OfflineMutation): Promise<'done' | 'partial' | 'failed'> {
  if (mutation.kind === 'CREATE_ORDER') {
    await executeMutation(mutation)
    return 'done'
  }

  const payload = mutation.payload as AddOrderItemsPayload
  const remaining: OrderLinePayload[] = []

  for (const item of payload.items) {
    const itemKey = `${mutation.id}:${item.menuItemId}`
    try {
      await postOrderItem(payload.orderId, item, itemKey)
    } catch (err) {
      if (isPermanentClientError(err)) {
        remaining.push(item)
      } else {
        throw err
      }
    }
  }

  if (remaining.length === 0) return 'done'
  if (remaining.length === payload.items.length) return 'failed'
  await updateMutationPayload(mutation.id, { ...payload, items: remaining })
  return 'partial'
}

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (flushing || typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 }
  }

  flushing = true
  notifyListeners()

  let synced = 0
  let failed = 0

  try {
    const pending = await listPendingMutations()

    for (const mutation of pending) {
      try {
        const result = await executeMutationPartial(mutation)
        if (result === 'done') {
          await removeMutation(mutation.id)
          synced++
        } else if (result === 'partial') {
          failed++
          toast.error(i18n.t('offline.partialSync'), { duration: 5000 })
        } else {
          failed++
        }
      } catch (err) {
        if (isRetryableNetworkError(err)) {
          await updateMutationFailure(
            mutation.id,
            err instanceof Error ? err.message : 'NETWORK_ERROR',
          )
          continue
        }

        const message =
          (err as AxiosError<{ error?: string }>).response?.data?.error
          ?? (err instanceof Error ? err.message : 'SYNC_FAILED')

        failed++
        if (isPermanentClientError(err)) {
          console.error(`[Offline] Dropping mutation ${mutation.id} permanently:`, message)
          toast.error(i18n.t('offline.dropFailed', { message }), { duration: 6000 })
          await removeMutation(mutation.id)
        } else {
          await updateMutationFailure(mutation.id, message)
        }
      }
    }

    if (synced > 0) {
      onSyncedCallback?.()
    }
  } finally {
    flushing = false
    notifyListeners()
  }

  return { synced, failed }
}

export function initOfflineSync(onSynced?: () => void): () => void {
  initCount++
  onSyncedCallback = onSynced ?? onSyncedCallback

  if (initCount === 1) {
    window.addEventListener('online', handleOnlineEvent)
    flushTimer = setInterval(() => {
      if (navigator.onLine) void flushOfflineQueue()
    }, 25_000)
    void flushOfflineQueue()
  }

  return () => {
    initCount = Math.max(0, initCount - 1)
    if (initCount === 0) {
      window.removeEventListener('online', handleOnlineEvent)
      if (flushTimer) {
        clearInterval(flushTimer)
        flushTimer = null
      }
      onSyncedCallback = null
    }
  }
}

async function tryOrQueue(
  mutation: Omit<OfflineMutation, 'createdAt' | 'retryCount'>,
): Promise<SubmitResult> {
  try {
    await executeMutation({
      ...mutation,
      createdAt: Date.now(),
      retryCount: 0,
    })
    return 'synced'
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err

    await enqueueMutation({
      ...mutation,
      createdAt: Date.now(),
      retryCount: 0,
    })
    notifyListeners()
    void flushOfflineQueue()
    return 'queued'
  }
}

export async function submitCreateOrder(
  payload: CreateOrderPayload,
  options?: { label?: string },
): Promise<SubmitResult> {
  return tryOrQueue({
    id: createMutationId(),
    kind: 'CREATE_ORDER',
    payload,
    label: options?.label,
  })
}

export async function submitAddOrderItems(
  payload: AddOrderItemsPayload,
  options?: { label?: string },
): Promise<SubmitResult> {
  return tryOrQueue({
    id: createMutationId(),
    kind: 'ADD_ORDER_ITEMS',
    payload,
    label: options?.label,
  })
}

export async function retryOfflineQueueNow(): Promise<{ synced: number; failed: number }> {
  return flushOfflineQueue()
}
