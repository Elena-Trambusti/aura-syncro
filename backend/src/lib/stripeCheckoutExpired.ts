import type { StripeCheckoutSessionPayload } from './stripeTypes'
import { cancelAbandonedGuestOrder } from './abandonedGuestCheckout'

/** Annulla ordini guest Stripe non completati (checkout scaduto). */
export async function handleCheckoutSessionExpired(
  session: StripeCheckoutSessionPayload,
): Promise<void> {
  const orderId = session.metadata?.orderId
  if (!orderId) return
  const cancelled = await cancelAbandonedGuestOrder(orderId)
  if (cancelled) {
    console.info('[stripe-webhook] Ordine guest annullato (checkout scaduto):', orderId)
  }
}
