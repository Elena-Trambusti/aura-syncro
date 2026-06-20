import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

function getSocketUrl(): string | undefined {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  return envUrl ? envUrl.replace(/\/$/, '') : undefined
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl() ?? '/', {
      auth: { token: localStorage.getItem('token') },
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket(token: string): void {
  const s = getSocket()
  s.auth = { token }
  s.connect()
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
