import { prisma } from './prisma'
import { stripe, STRIPE_ENABLED } from './stripe'

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
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '')

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: reservation.guestEmail || undefined,
    metadata: {
      reservationId: reservation.id,
      restaurantId: reservation.restaurantId,
    },
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Caparra prenotazione — ${reservation.restaurant.name}`,
          description: `${reservation.covers} persone · ${new Date(reservation.date).toLocaleDateString('it-IT')}`,
        },
        unit_amount: Math.round(depositAmount * 100),
      },
      quantity: 1,
    }],
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
