import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'

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

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
    }

    for (const event of TABLE_EVENTS) {
      socket.on(event, refresh)
    }

    return () => {
      for (const event of TABLE_EVENTS) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient])
}

export function useRealtimeQuery(events: readonly string[], queryKey: string): void {
  const queryClient = useQueryClient()
  const eventsKey = events.join('|')

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const eventList = eventsKey.split('|').filter(Boolean)
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
    }

    for (const event of eventList) {
      socket.on(event, refresh)
    }

    return () => {
      for (const event of eventList) {
        socket.off(event, refresh)
      }
    }
  }, [queryClient, queryKey, eventsKey])
}
