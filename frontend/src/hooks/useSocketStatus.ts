import { useEffect, useState } from 'react'
import { getSocket } from '../lib/socket'

export function useSocketStatus() {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const socket = getSocket()

    // Initialize with current status
    setIsConnected(socket.connected)

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)
    const onConnectError = () => setIsConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [])

  return isConnected
}
