import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export function setupSocketHandlers(io: Server): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      next(new Error('Token mancante'))
      return
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string
        restaurantId: string
        role: string
      }
      socket.data.userId = payload.userId
      socket.data.restaurantId = payload.restaurantId
      socket.data.role = payload.role
      next()
    } catch {
      next(new Error('Token non valido'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const { restaurantId, userId } = socket.data
    socket.join(restaurantId)
    console.log(`👤 Utente ${userId} connesso al ristorante ${restaurantId}`)

    socket.on('disconnect', () => {
      console.log(`👤 Utente ${userId} disconnesso`)
    })

    socket.on('table:update_position', (data: { id: string; posX: number; posY: number }) => {
      socket.to(restaurantId).emit('table:position_changed', data)
    })

    socket.on('kitchen:item_ready', (data: { orderId: string; itemId: string }) => {
      io.to(restaurantId).emit('kitchen:item_ready', data)
    })
  })
}
