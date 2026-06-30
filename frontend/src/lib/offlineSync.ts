import type { AxiosError } from 'axios'
import { toast } from '@/lib/toast'
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
const TENANT_STORAGE_KEY = 'restaurantId'
const MAX_PARTIAL_RETRIES = 8

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
  if (ax.code === 'ERR_CANCELED') return false
  if (err instanceof Error && err.message === 'DEMO_READ_ONLY') return false
  if (!ax.response) return true
  if (ax.code === 'ECONNABORTED' || ax.code === 'ERR_NETWORK') return true
  const status = ax.response.status
  const message = ((ax.response.data as { error?: string } | undefined)?.error ?? '').toLowerCase()
  if (status === 409 && (message.includes('elaborazione') || message.includes('idempotency') || message.includes('processing'))) {
    return true
  }
  return status >= 502 && status <= 504
}

export function isPermanentClientError(err: unknown): boolean {
  const ax = err as AxiosError<{ code?: string; error?: string }>
  if (!ax.response) return false
  const status = ax.response.status
  const code = ax.response.data?.code
  const message = (ax.response.data?.error ?? '').toLowerCase()
  if (status === 409) {
    if (message.includes('elaborazione') || message.includes('idempotency') || message.includes('processing')) {
      return false
    }
    return true
  }
  if (status === 400 || status === 401 || status === 403 || status === 404) return true
  if (code === 'MENU_ITEM_SOLD_OUT' || code === 'MENU_ITEM_UNAVAILABLE' || code === 'TABLE_OCCUPIED') return true
  return false
}

function isLikelyIdempotencyDuplicate(err: unknown): boolean {
  const ax = err as AxiosError<{ code?: string; error?: string }>
  if (!ax.response || ax.response.status !== 409) return false
  const code = ax.response.data?.code
  const message = (ax.response.data?.error ?? '').toLowerCase()
  if (code === 'ORDER_DUPLICATE') return true
  return (
    message.includes('idempotency')
    || message.includes('duplicata')
    || message.includes('duplicato')
    || message.includes('già in elaborazione')
  )
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

function itemIdempotencyKey(baseMutationId: string, item: OrderLinePayload, index: number): string {
  const modifiers = (item.modifiers ?? []).join(',')
  const notes = item.notes ?? ''
  return `${baseMutationId}:${item.menuItemId}:${index}:${item.quantity}:${item.course ?? 1}:${modifiers}:${notes}`
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
  for (const [index, item] of payload.items.entries()) {
    const itemKey = itemIdempotencyKey(mutation.id, item, index)
    await postOrderItem(payload.orderId, item, itemKey)
  }
}

async function executeMutationPartial(mutation: OfflineMutation): Promise<'done' | 'partial' | 'failed'> {
  if (mutation.kind === 'CREATE_ORDER') {
    try {
      await executeMutation(mutation)
    } catch (err) {
      if (isLikelyIdempotencyDuplicate(err)) {
        return 'done'
      }
      throw err
    }
    return 'done'
  }

  const payload = mutation.payload as AddOrderItemsPayload
  const remaining: OrderLinePayload[] = []

  for (const [index, item] of payload.items.entries()) {
    const itemKey = itemIdempotencyKey(mutation.id, item, index)
    try {
      await postOrderItem(payload.orderId, item, itemKey)
    } catch (err) {
      if (isLikelyIdempotencyDuplicate(err)) {
        continue
      }
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

    const activeTenantId = typeof localStorage !== 'undefined'
      ? localStorage.getItem(TENANT_STORAGE_KEY)
      : null

    for (let mutation of pending) {
      if (!mutation.tenantId && activeTenantId) {
        mutation = { ...mutation, tenantId: activeTenantId }
        await enqueueMutation(mutation)
      }
      if (mutation.tenantId && activeTenantId && mutation.tenantId !== activeTenantId) {
        // Keep in queue until user returns to the owning tenant.
        continue
      }
      try {
        const result = await executeMutationPartial(mutation)
        if (result === 'done') {
          await removeMutation(mutation.id)
          synced++
        } else if (result === 'partial') {
          if (mutation.retryCount >= MAX_PARTIAL_RETRIES) {
            failed++
            await removeMutation(mutation.id)
            toast.error(i18n.t('offline.dropFailed', { message: 'PARTIAL_SYNC_EXHAUSTED' }), { duration: 6000 })
          } else {
            await updateMutationFailure(mutation.id, 'PARTIAL_SYNC')
          }
        } else {
          failed++
          await removeMutation(mutation.id)
          toast.error(i18n.t('offline.dropFailed', { message: 'SYNC_FAILED' }), { duration: 6000 })
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
  const tenantId = typeof localStorage !== 'undefined'
    ? localStorage.getItem(TENANT_STORAGE_KEY) ?? undefined
    : undefined
  try {
    await executeMutation({
      ...mutation,
      tenantId,
      createdAt: Date.now(),
      retryCount: 0,
    })
    return 'synced'
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err

    await enqueueMutation({
      ...mutation,
      tenantId,
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
