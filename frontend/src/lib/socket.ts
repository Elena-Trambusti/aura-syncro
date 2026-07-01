import type { Socket } from 'socket.io-client'
import { resolveBackendUrl } from './backendUrl'
import { getSessionToken } from './sessionToken'

let socket: Socket | null = null
let ioModule: typeof import('socket.io-client') | null = null

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected)
}

function getSocketUrl(): string | undefined {
  return resolveBackendUrl()
}

async function loadIo() {
  if (!ioModule) ioModule = await import('socket.io-client')
  return ioModule
}

/** Socket realtime — caricato on-demand (non nel bundle critico della landing). */
export async function getSocket(): Promise<Socket> {
  if (!socket) {
    const { io } = await loadIo()
    socket = io(getSocketUrl() ?? '/', {
      auth: { token: getSessionToken() },
      autoConnect: false,
      withCredentials: true,
    })
  }
  return socket
}

export async function ensureSocketConnected(): Promise<Socket> {
  const s = await getSocket()
  if (!s.connected) s.connect()
  return s
}

export async function connectSocket(token: string): Promise<void> {
  const existingToken = socket ? (socket.auth as { token?: string }).token : undefined
  if (socket?.connected && existingToken && existingToken !== token) {
    socket.disconnect()
    socket = null
  }
  const s = await getSocket()
  s.auth = { token }
  if (!s.connected) {
    s.connect()
  }
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
