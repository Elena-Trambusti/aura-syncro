import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ensureSocketConnected } from '../lib/socket'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import {
  patchTableFromOrderEvent,
  patchTableInQueryCache,
  type TableSocketPatch,
} from '../lib/tableQueryCache'

const TABLE_ONLY_EVENTS = [
  'tables:updated',
  'table:created',
  'table:deleted',
  'table:position_changed',
] as const

const REFRESH_THROTTLE_MS = 220
const ANALYTICS_SUMMARY_THROTTLE_MS = 5_000

/**
 * Mantiene la query tavoli allineata via Socket.IO (sostituisce il polling).
 */
export function useRealtimeTables(): void {
  const queryClient = useQueryClient()
  const tenantKey = useTenantQueryKey()

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof ensureSocketConnected>> | null = null
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null
    let queued = false

    const runRefresh = () => {
      queued = false
      void queryClient.invalidateQueries({
        queryKey: tq(tenantKey, 'tables'),
        refetchType: 'active',
      })
      void queryClient.invalidateQueries({
        queryKey: tq(tenantKey, 'floor-layout'),
        refetchType: 'active',
      })
    }

    const refresh = () => {
      if (queued) return
      queued = true
      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }
      refreshTimeout = setTimeout(runRefresh, REFRESH_THROTTLE_MS)
    }

    const onTableUpdated = (payload: TableSocketPatch) => {
      const patched = patchTableInQueryCache(queryClient, tenantKey, payload)
      if (!patched) refresh()
    }

    const onOrderEvent = (order: Parameters<typeof patchTableFromOrderEvent>[2]) => {
      const patched = patchTableFromOrderEvent(queryClient, tenantKey, order)
      if (!patched) refresh()
    }

    void ensureSocketConnected()
      .then((s) => {
        if (cancelled) return
        socket = s
        s.on('table:updated', onTableUpdated)
        s.on('order:created', onOrderEvent)
        s.on('order:updated', onOrderEvent)
        for (const event of TABLE_ONLY_EVENTS) {
          s.on(event, refresh)
        }
      })
      .catch(() => { /* fallback polling React Query */ })

    return () => {
      cancelled = true
      if (refreshTimeout) clearTimeout(refreshTimeout)
      if (!socket) return
      socket.off('table:updated', onTableUpdated)
      socket.off('order:created', onOrderEvent)
      socket.off('order:updated', onOrderEvent)
      for (const event of TABLE_ONLY_EVENTS) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient, tenantKey])
}

export function useRealtimeOrders(): void {
  useRealtimeQuery(['order:created', 'order:updated'], 'orders')
  useRealtimeQuery(['order:created', 'order:updated'], 'inventory')
  useRealtimeQuery(['order:created', 'order:updated'], 'menu')
  useRealtimeQueryThrottled(
    ['order:created', 'order:updated'],
    ANALYTICS_SUMMARY_THROTTLE_MS,
    'analytics',
    'summary',
  )
}

const RESERVATION_EVENTS = [
  'reservation:created',
  'reservation:updated',
  'reservation:deleted',
  'reservation:deposit_paid',
] as const

export function useRealtimeReservations(): void {
  useRealtimeQuery(RESERVATION_EVENTS, 'reservations')
}

export function useRealtimeQuery(events: readonly string[], ...queryKeyParts: string[]): void {
  useRealtimeQueryThrottled(events, REFRESH_THROTTLE_MS, ...queryKeyParts)
}

function useRealtimeQueryThrottled(
  events: readonly string[],
  throttleMs: number,
  ...queryKeyParts: string[]
): void {
  const queryClient = useQueryClient()
  const tenantKey = useTenantQueryKey()
  const eventsKey = events.join('|')

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof ensureSocketConnected>> | null = null
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null
    let queued = false
    const eventList = eventsKey.split('|').filter(Boolean)

    const runRefresh = () => {
      queued = false
      void queryClient.invalidateQueries({ queryKey: tq(tenantKey, ...queryKeyParts), refetchType: 'active' })
    }

    const refresh = () => {
      if (queued) return
      queued = true
      if (refreshTimeout) clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(runRefresh, throttleMs)
    }

    void ensureSocketConnected()
      .then((s) => {
        if (cancelled) return
        socket = s
        for (const event of eventList) {
          s.on(event, refresh)
        }
      })
      .catch(() => { /* fallback polling React Query */ })

    return () => {
      cancelled = true
      if (refreshTimeout) clearTimeout(refreshTimeout)
      if (!socket) return
      for (const event of eventList) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient, tenantKey, eventsKey, throttleMs, queryKeyParts.join('|')])
}
