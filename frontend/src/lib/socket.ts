import { io, Socket } from 'socket.io-client'
import { resolveBackendUrl } from './backendUrl'
import { getSessionToken } from './sessionToken'

let socket: Socket | null = null

function getSocketUrl(): string | undefined {
  return resolveBackendUrl()
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl() ?? '/', {
      auth: { token: getSessionToken() },
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket(token: string): void {
  const existingToken = socket ? (socket.auth as { token?: string }).token : undefined
  if (socket?.connected && existingToken && existingToken !== token) {
    socket.disconnect()
    socket = null
  }
  const s = getSocket()
  s.auth = { token }
  if (!s.connected) {
    s.connect()
  }
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
