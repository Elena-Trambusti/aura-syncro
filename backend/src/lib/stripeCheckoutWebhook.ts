import { io } from '../index'
import { completeGuestStripePayment } from './completePayment'
import { markReservationDepositPaid } from './depositWebhook'
import { activateRestaurantSubscription } from './stripeSubscriptionWebhook'
import { linkCustomerToOrder } from './customerResolver'

export type CheckoutSessionWebhookPayload = {
  id?: string
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
  subscription?: string | { id: string } | null
  mode?: string | null
  payment_intent?: unknown
  payment_status?: string | null
  amount_total?: number | null
  customer_details?: { email?: string | null; name?: string | null; phone?: string | null } | null
}

/** Gestisce checkout.session.completed per abbonamento SaaS, ordini guest e caparre. */
export async function handleCheckoutSessionCompleted(
  session: CheckoutSessionWebhookPayload,
): Promise<void> {
  const reservationId = session.metadata?.reservationId
  if (reservationId) {
    const deposit = await markReservationDepositPaid(session)
    if (deposit) {
      console.info(
        '[stripe-webhook] Caparra prenotazione',
        deposit.reservationId,
        deposit.fundsCaptured ? `pagata €${deposit.amountPaid}` : 'carta salvata',
      )
      io.to(deposit.restaurantId).emit('reservation:deposit_paid', {
        reservationId: deposit.reservationId,
        amountPaid: deposit.amountPaid,
        fundsCaptured: deposit.fundsCaptured,
      })
    }
    return
  }

  const orderId = session.metadata?.orderId
  if (orderId) {
    if (session.payment_status === 'paid') {
      const restaurantId = session.metadata?.restaurantId
      if (restaurantId) {
        await linkCustomerToOrder(orderId, restaurantId, {
          email: session.customer_details?.email ?? session.metadata?.customerEmail,
          name: session.customer_details?.name ?? session.metadata?.customerName,
          phone: session.customer_details?.phone ?? undefined,
        })
      }
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : typeof session.payment_intent === 'object' && session.payment_intent && 'id' in session.payment_intent
            ? String((session.payment_intent as { id: string }).id)
            : null
      const completed = await completeGuestStripePayment(
        orderId,
        paymentIntentId,
        session.amount_total ?? null,
        session.id,
      )
      if (completed?.updatedOrder) {
        console.info('[stripe-webhook] Ordine guest pagato', orderId)
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
  } else if (
    session.mode === 'subscription'
    || session.metadata?.plan === 'premium'
    || session.metadata?.plan === 'PREMIUM'
    || session.metadata?.plan === 'STARTER'
  ) {
    console.info(
      '[stripe-webhook] Checkout subscription non attivato (payment_status/filtro):',
      session.payment_status,
    )
  }
}
