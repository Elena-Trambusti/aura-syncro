const DB_NAME = 'aura-syncro-offline'
const DB_VERSION = 1
const STORE = 'mutations'

export type OfflineMutationKind = 'CREATE_ORDER' | 'ADD_ORDER_ITEMS' | 'FINALIZE_ORDER_CASH'

export interface OrderLinePayload {
  menuItemId: string
  quantity: number
  course?: number
  modifiers?: string[]
  notes?: string
}

export interface CreateOrderPayload {
  tableId: string
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  items: OrderLinePayload[]
  customerId?: string
}

export interface AddOrderItemsPayload {
  orderId: string
  items: OrderLinePayload[]
}

export interface FinalizeOrderCashPayload {
  orderId: string
  paymentMethod: 'CASH'
  tipAmount?: number
}

export interface OfflineMutation {
  id: string
  kind: OfflineMutationKind
  /** Tenant owner della mutation per evitare replay cross-tenant */
  tenantId?: string
  payload: CreateOrderPayload | AddOrderItemsPayload | FinalizeOrderCashPayload
  createdAt: number
  retryCount: number
  lastError?: string
  /** Etichetta UI es. "Tavolo 5" */
  label?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('IDB_OPEN_FAILED'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        const request = fn(store)
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error ?? new Error('IDB_TX_FAILED'))
        tx.oncomplete = () => db.close()
        tx.onerror = () => reject(tx.error ?? new Error('IDB_TX_FAILED'))
      }),
  )
}

export function isOfflineQueueSupported(): boolean {
  return typeof indexedDB !== 'undefined'
}

export async function listPendingMutations(): Promise<OfflineMutation[]> {
  if (!isOfflineQueueSupported()) return []
  const rows = await runTransaction<OfflineMutation[]>('readonly', store =>
    store.getAll() as IDBRequest<OfflineMutation[]>,
  )
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export async function countPendingMutations(): Promise<number> {
  const rows = await listPendingMutations()
  return rows.length
}

export async function enqueueMutation(mutation: OfflineMutation): Promise<void> {
  if (!isOfflineQueueSupported()) {
    throw new Error('OFFLINE_QUEUE_UNSUPPORTED')
  }
  await runTransaction('readwrite', store => store.put(mutation))
}

export async function removeMutation(id: string): Promise<void> {
  if (!isOfflineQueueSupported()) return
  await runTransaction('readwrite', store => store.delete(id))
}

export async function updateMutationFailure(id: string, error: string): Promise<void> {
  if (!isOfflineQueueSupported()) return
  const rows = await listPendingMutations()
  const row = rows.find(r => r.id === id)
  if (!row) return
  await enqueueMutation({
    ...row,
    retryCount: row.retryCount + 1,
    lastError: error,
  })
}

export async function updateMutationPayload(id: string, payload: OfflineMutation['payload']): Promise<void> {
  if (!isOfflineQueueSupported()) return
  const rows = await listPendingMutations()
  const row = rows.find(r => r.id === id)
  if (!row) return
  await enqueueMutation({ ...row, payload })
}

export async function clearAllMutations(): Promise<void> {
  if (!isOfflineQueueSupported()) return
  await runTransaction('readwrite', store => store.clear())
}

export function createMutationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `mut_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}
