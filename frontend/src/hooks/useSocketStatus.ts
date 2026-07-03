import { useEffect, useState } from 'react'
import { ensureSocketConnected, isSocketConnected } from '../lib/socket'

export function useSocketStatus() {
  const [isConnected, setIsConnected] = useState(() => isSocketConnected())

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof ensureSocketConnected>> | null = null

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)
    const onConnectError = () => setIsConnected(false)

    void ensureSocketConnected().then((s) => {
      if (cancelled) return
      socket = s
      setIsConnected(s.connected)
      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)
      s.on('connect_error', onConnectError)
    })

    return () => {
      cancelled = true
      if (!socket) return
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [])

  return isConnected
}
