import { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma'
import { requireSocketRole, verifySocketToken } from '../middleware/auth'
import { isDemoUserEmail } from '../lib/demoSandbox'

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

export function setupSocketHandlers(io: Server): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
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
    console.log(`👤 Utente ${userId} connesso al ristorante ${restaurantId}`)

    const sessionCheck = setInterval(async () => {
      if (!(await verifyLiveSocketSession(socket))) {
        clearInterval(sessionCheck)
      }
    }, 5 * 60 * 1000)

    socket.on('disconnect', () => {
      clearInterval(sessionCheck)
      console.log(`👤 Utente ${userId} disconnesso`)
    })

    socket.on('table:update_position', async (data: { id: string; posX: number; posY: number }) => {
      if (!(await verifyLiveSocketSession(socket))) return
      if (blockDemoSocketWrite(socket)) return
      if (!requireSocketRole(socket.data.role, 'OWNER', 'MANAGER')) return

      const table = await prisma.table.findFirst({
        where: { id: data.id, restaurantId },
      })
      if (!table) return

      socket.to(restaurantId).emit('table:position_changed', data)
    })
  })
}
