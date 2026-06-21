import { io } from '../index'
import { completeGuestStripePayment } from './completePayment'
import { markReservationDepositPaid } from './depositWebhook'
import { activateRestaurantSubscription } from './stripeSubscriptionWebhook'

export type CheckoutSessionWebhookPayload = {
  id?: string
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
  subscription?: string | { id: string } | null
  mode?: string | null
  payment_intent?: unknown
  payment_status?: string | null
  amount_total?: number | null
}

/** Gestisce checkout.session.completed per abbonamento SaaS, ordini guest e caparre. */
export async function handleCheckoutSessionCompleted(
  session: CheckoutSessionWebhookPayload,
): Promise<void> {
  const reservationId = session.metadata?.reservationId
  if (reservationId) {
    const deposit = await markReservationDepositPaid(session)
    if (deposit) {
      console.info('[stripe-webhook] Caparra pagata', deposit.reservationId, deposit.amountPaid)
      io.to(deposit.restaurantId).emit('reservation:deposit_paid', {
        reservationId: deposit.reservationId,
        amountPaid: deposit.amountPaid,
      })
    }
    return
  }

  const orderId = session.metadata?.orderId
  if (orderId) {
    if (session.payment_status === 'paid') {
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : typeof session.payment_intent === 'object' && session.payment_intent && 'id' in session.payment_intent
            ? String((session.payment_intent as { id: string }).id)
            : null
      const completed = await completeGuestStripePayment(orderId, paymentIntentId)
      if (completed?.updatedOrder) {
        console.info('[stripe-webhook] Ordine guest pagato', orderId)
        io.to(completed.updatedOrder.restaurantId).emit('order:updated', completed.updatedOrder)
        io.to(completed.updatedOrder.restaurantId).emit('order:new', completed.updatedOrder)
      }
    } else {
      console.warn('[stripe-webhook] Sessione guest non pagata, ordine non finalizzato:', orderId)
    }
    return
  }

  const result = await activateRestaurantSubscription(session)
  if (result) {
    console.info(
      '[stripe-webhook] Premium attivato',
      result.restaurantId,
      result.stripeSubscriptionId ?? '(no subscription id)',
    )
  }
}
