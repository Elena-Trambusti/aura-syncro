import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
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
