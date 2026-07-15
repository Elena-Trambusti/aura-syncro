import { io } from '../index'
import { completeGuestStripePayment } from './completePayment'
import type { StripePaymentIntentPayload } from './stripeTypes'

export async function handlePaymentIntentSucceeded(
  intent: StripePaymentIntentPayload,
): Promise<void> {
  const orderId = intent.metadata?.orderId

  if (orderId) {
    const amountCents =
      typeof intent.amount_received === 'number' && intent.amount_received > 0
        ? intent.amount_received
        : typeof intent.amount === 'number'
          ? intent.amount
          : null
    const completed = await completeGuestStripePayment(orderId, intent.id, amountCents)
    if (completed?.updatedOrder) {
      console.info('[stripe-webhook] Ordine guest pagato tramite PaymentIntent', orderId)
      io.to(completed.updatedOrder.restaurantId).emit('order:updated', completed.updatedOrder)
      io.to(completed.updatedOrder.restaurantId).emit('order:created', completed.updatedOrder)
    }
  } else {
    console.info(
      '[stripe-webhook] PaymentIntent succeeded ma nessun orderId nei metadati',
      intent.id,
    )
  }
}

export async function handlePaymentIntentFailed(
  intent: StripePaymentIntentPayload,
): Promise<void> {
  const orderId = intent.metadata?.orderId

  if (orderId) {
    console.warn(
      '[stripe-webhook] Pagamento fallito per ordine',
      orderId,
      'Intent:',
      intent.id,
    )
  } else {
    console.warn('[stripe-webhook] PaymentIntent fallito', intent.id)
  }
}
