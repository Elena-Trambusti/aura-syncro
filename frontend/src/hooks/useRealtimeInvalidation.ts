import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket, ensureSocketConnected } from '../lib/socket'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

const TABLE_EVENTS = [
  'table:updated',
  'tables:updated',
  'table:created',
  'table:deleted',
  'table:position_changed',
  'order:created',
  'order:updated',
] as const

/**
 * Keeps the tables query in sync via Socket.IO (replaces polling).
 */
export function useRealtimeTables(): void {
  const queryClient = useQueryClient()
  const tenantKey = useTenantQueryKey()

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: tq(tenantKey, 'tables') })
      queryClient.invalidateQueries({ queryKey: tq(tenantKey, 'floor-layout') })
    }

    void ensureSocketConnected()
      .then((s) => {
        if (cancelled) return
        socket = s
        for (const event of TABLE_EVENTS) {
          s.on(event, refresh)
        }
      })
      .catch(() => { /* polling fallback via React Query */ })

    return () => {
      cancelled = true
      if (!socket) return
      for (const event of TABLE_EVENTS) {
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
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null
    const eventList = eventsKey.split('|').filter(Boolean)

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: tq(tenantKey, ...queryKeyParts) })
    }

    void ensureSocketConnected()
      .then((s) => {
        if (cancelled) return
        socket = s
        for (const event of eventList) {
          s.on(event, refresh)
        }
      })
      .catch(() => { /* polling fallback via React Query */ })

    return () => {
      cancelled = true
      if (!socket) return
      for (const event of eventList) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient, tenantKey, eventsKey, queryKeyParts.join('|')])
}
