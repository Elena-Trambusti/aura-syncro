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

/**
 * Mantiene la query tavoli allineata via Socket.IO (sostituisce il polling).
 */
export function useRealtimeTables(): void {
  const queryClient = useQueryClient()
  const tenantKey = useTenantQueryKey()

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof ensureSocketConnected>> | null = null

    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: tq(tenantKey, 'tables'),
        refetchType: 'active',
      })
      void queryClient.invalidateQueries({
        queryKey: tq(tenantKey, 'floor-layout'),
        refetchType: 'active',
      })
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
  useRealtimeQuery(['order:created', 'order:updated'], 'analytics')
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
  const queryClient = useQueryClient()
  const tenantKey = useTenantQueryKey()
  const eventsKey = events.join('|')

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof ensureSocketConnected>> | null = null
    const eventList = eventsKey.split('|').filter(Boolean)

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: tq(tenantKey, ...queryKeyParts) })
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
      if (!socket) return
      for (const event of eventList) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient, tenantKey, eventsKey, queryKeyParts.join('|')])
}
