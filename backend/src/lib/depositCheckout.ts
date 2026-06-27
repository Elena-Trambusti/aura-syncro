import { prisma } from './prisma'
import { stripe, STRIPE_ENABLED, STRIPE_APPLICATION_FEE_PCT } from './stripe'
import { resolvePrimaryFrontendUrl } from './frontendUrl'

export async function createDepositCheckoutSession(
  reservationId: string,
  slug: string,
): Promise<{ checkoutUrl: string; sessionId: string }> {
  if (!STRIPE_ENABLED) {
    throw new Error('PAYMENTS_DISABLED')
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { restaurant: true },
  })

  if (!reservation || reservation.restaurant.slug !== slug) {
    throw new Error('NOT_FOUND')
  }

  if (reservation.depositPaid) {
    throw new Error('ALREADY_PAID')
  }

  if (reservation.depositStripeSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(reservation.depositStripeSessionId)
      if (existing.status === 'open' && existing.url) {
        return { checkoutUrl: existing.url, sessionId: existing.id }
      }
      if (existing.payment_status === 'paid') {
        throw new Error('ALREADY_PAID')
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_PAID') throw err
      // Sessione scaduta — ne creiamo una nuova
    }
  }

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: reservation.restaurantId },
  })

  const depositAmount = settings?.depositAmount || 10
  const connectAccountId = settings?.stripeConnectAccountId
  const frontendUrl = resolvePrimaryFrontendUrl()

  const depositTotal = depositAmount * reservation.covers

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer_email: reservation.guestEmail || undefined,
    currency: 'eur',
    metadata: {
      reservationId: reservation.id,
      restaurantId: reservation.restaurantId,
      depositAmount: depositTotal.toString(),
    },
    custom_text: {
      submit: {
        message: `La carta verrà salvata a garanzia di ${depositTotal.toFixed(2)}€ e addebitata SOLO in caso di no-show.`,
      }
    },
    success_url: `${frontendUrl}/payment/deposit-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/payment/cancel?reason=deposit`,
  })

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { depositStripeSessionId: session.id },
  })

  if (!session.url) {
    throw new Error('SESSION_URL_MISSING')
  }

  return { checkoutUrl: session.url, sessionId: session.id }
}
