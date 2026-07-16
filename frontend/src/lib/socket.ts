import type { Socket } from 'socket.io-client'
import { resolveSocketUrl } from './backendUrl'
import { getSessionToken } from './sessionToken'

let socket: Socket | null = null
let ioModule: typeof import('socket.io-client') | null = null

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected)
}

function getSocketUrl(): string | undefined {
  return resolveSocketUrl()
}

function buildSocketAuth(): { token?: string } {
  const token = getSessionToken()
  return token ? { token } : {}
}

async function loadIo() {
  if (!ioModule) ioModule = await import('socket.io-client')
  return ioModule
}

/** Socket realtime — cookie httpOnly o Bearer in memoria (fallback legacy). */
export async function getSocket(): Promise<Socket> {
  if (!socket) {
    const { io } = await loadIo()
    socket = io(getSocketUrl() ?? '/', {
      auth: buildSocketAuth(),
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

/** Connette il socket; senza token usa il cookie di sessione httpOnly. */
export async function connectSocket(token?: string | null): Promise<void> {
  const resolved = token ?? getSessionToken()
  const s = await getSocket()
  const existingToken = (s.auth as { token?: string } | undefined)?.token
  const nextAuth = resolved ? { token: resolved } : {}
  s.auth = nextAuth
  // Reuse the same Socket instance so listeners (tables/orders/KDS) stay bound after token rotate.
  if (s.connected && existingToken !== resolved) {
    s.disconnect()
    s.connect()
    return
  }
  if (!s.connected) {
    s.connect()
  }
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
