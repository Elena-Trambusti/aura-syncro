import { io } from '../index'
import { notifyNewOrder } from './webPush'

export function formatOrderCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

/** Socket in-app + Web Push nativo per nuovo ordine */
export async function broadcastNewOrderNotification(
  restaurantId: string,
  orderId: string,
  message: string,
): Promise<void> {
  io.to(restaurantId).emit('notification', {
    type: 'new_order',
    message,
    orderId,
  })
  await notifyNewOrder(restaurantId, message, orderId)
}
