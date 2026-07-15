import { timingSafeEqual } from 'crypto'
import { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { requireSocketRole, verifySocketToken } from '../middleware/auth'
import { isDemoUserEmail } from '../lib/demoSandbox'
import { SESSION_COOKIE_NAME } from '../lib/sessionCookie'

function extractSocketTokenFromCookieHeader(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) continue
    const raw = trimmed.slice(`${SESSION_COOKIE_NAME}=`.length)
    if (!raw) return null
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}

async function verifyLiveSocketSession(socket: Socket): Promise<boolean> {
  const userId = socket.data.userId as string | undefined
  const restaurantId = socket.data.restaurantId as string | undefined
  if (!userId || !restaurantId) return false

  const user = await prisma.user.findFirst({
    where: { id: userId, restaurantId, active: true },
    select: { role: true, tokenVersion: true, email: true },
  })
  if (!user) return false

  const tv = socket.data.tokenVersion as number | undefined
  if (user.tokenVersion !== (tv ?? 0)) {
    socket.disconnect(true)
    return false
  }

  socket.data.role = user.role
  socket.data.userEmail = user.email
  return true
}

function blockDemoSocketWrite(socket: Socket): boolean {
  const email = socket.data.userEmail as string | undefined
  if (email && isDemoUserEmail(email)) return true
  return false
}

async function verifyPrintAgentToken(
  restaurantId: string,
  token: string,
): Promise<boolean> {
  if (!restaurantId || !token) return false
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
    select: { printAgentToken: true },
  })
  const expected = settings?.printAgentToken
  if (!expected) return false
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(token, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function setupSocketHandlers(io: Server): void {
  io.use(async (socket, next) => {
    const authToken = socket.handshake.auth.token
    const authPrintToken = socket.handshake.auth.printToken
    const headerRestaurantId =
      typeof socket.handshake.headers['x-restaurant-id'] === 'string'
        ? socket.handshake.headers['x-restaurant-id']
        : undefined

    // Print Agent: pairing token (non JWT) + header tenant.
    if (
      headerRestaurantId
      && typeof authPrintToken === 'string'
      && authPrintToken.length > 0
      && await verifyPrintAgentToken(headerRestaurantId, authPrintToken)
    ) {
      socket.data.userId = 'print-agent'
      socket.data.restaurantId = headerRestaurantId
      socket.data.role = 'PRINT_AGENT'
      socket.data.userEmail = 'print-agent@local'
      socket.data.tokenVersion = 0
      next()
      return
    }

    const cookieHeader = typeof socket.handshake.headers.cookie === 'string'
      ? socket.handshake.headers.cookie
      : undefined
    const cookieToken = extractSocketTokenFromCookieHeader(cookieHeader)
    const token = typeof authToken === 'string' && authToken.length > 0 ? authToken : cookieToken
    if (!token || typeof token !== 'string') {
      next(new Error('Token mancante'))
      return
    }
    const session = await verifySocketToken(token)
    if (!session) {
      next(new Error('Token non valido'))
      return
    }
    socket.data.userId = session.userId
    socket.data.restaurantId = session.restaurantId
    socket.data.role = session.role
    socket.data.userEmail = session.email
    socket.data.tokenVersion = session.tokenVersion
    next()
  })

  io.on('connection', (socket: Socket) => {
    const { restaurantId, userId } = socket.data
    socket.join(restaurantId)
    logger.debug(`Socket connect user=${userId} restaurant=${restaurantId}`)

    const sessionCheck = setInterval(async () => {
      if (!(await verifyLiveSocketSession(socket))) {
        clearInterval(sessionCheck)
      }
    }, 5 * 60 * 1000)

    socket.on('disconnect', () => {
      clearInterval(sessionCheck)
      logger.debug(`Socket disconnect user=${userId}`)
    })

    socket.on('table:update_position', async (data: { id: string; posX: number; posY: number }) => {
      if (!(await verifyLiveSocketSession(socket))) return
      if (blockDemoSocketWrite(socket)) return
      if (!requireSocketRole(socket.data.role, 'OWNER', 'MANAGER')) return

      const updated = await prisma.table.updateMany({
        where: { id: data.id, restaurantId },
        data: { posX: data.posX, posY: data.posY },
      })
      if (updated.count === 0) return
      io.to(restaurantId).emit('table:position_changed', data)
    })
  })
}
