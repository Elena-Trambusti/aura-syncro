import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

const TABLE_EVENTS = [
  'table:updated',
  'table:created',
  'table:deleted',
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
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: tq(tenantKey, 'tables') })
    }

    for (const event of TABLE_EVENTS) {
      socket.on(event, refresh)
    }

    return () => {
      for (const event of TABLE_EVENTS) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient, tenantKey])
}

export function useRealtimeQuery(events: readonly string[], queryKey: string): void {
  const queryClient = useQueryClient()
  const tenantKey = useTenantQueryKey()
  const eventsKey = events.join('|')

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const eventList = eventsKey.split('|').filter(Boolean)
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: tq(tenantKey, queryKey) })
    }

    for (const event of eventList) {
      socket.on(event, refresh)
    }

    return () => {
      for (const event of eventList) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient, tenantKey, queryKey, eventsKey])
}
