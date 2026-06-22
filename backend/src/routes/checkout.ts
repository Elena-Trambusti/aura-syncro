import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { stripe, STRIPE_ENABLED } from '../lib/stripe'
import { AuthRequest, requireRole } from '../middleware/auth'
import { resolvePrimaryFrontendUrl } from '../lib/frontendUrl'

export const checkoutRouter = Router()

function resolveStripePriceIds(): { setup: string; subscription: string } | null {
  const setup = process.env.STRIPE_PRICE_SETUP?.trim()
  const subscription = process.env.STRIPE_PRICE_SUBSCRIPTION?.trim()
  if (!setup || !subscription) return null
  return { setup, subscription }
}

/** POST /api/checkout — Stripe Checkout Session (setup €500 + abbonamento €199/mo, tutto incluso) */
checkoutRouter.post('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Stripe non configurato. Inserisci STRIPE_SECRET_KEY in backend/.env' })
    return
  }

  const userId = req.userId
  const restaurantId = req.restaurantId
  if (!userId || !restaurantId) {
    res.status(401).json({ error: 'Autenticazione richiesta' })
    return
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
    select: { email: true, name: true },
  })

  if (!user) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  const stripePrices = resolveStripePriceIds()
  if (!stripePrices) {
    res.status(503).json({
      error: 'Prezzi Stripe non configurati. Imposta STRIPE_PRICE_SETUP e STRIPE_PRICE_SUBSCRIPTION in backend/.env',
    })
    return
  }

  const frontendUrl = resolvePrimaryFrontendUrl()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: restaurantId,
      line_items: [
        { price: stripePrices.setup, quantity: 1 },
        { price: stripePrices.subscription, quantity: 1 },
      ],
      metadata: {
        restaurantId,
        userId,
        plan: 'premium',
      },
      subscription_data: {
        metadata: {
          restaurantId,
          userId,
          plan: 'premium',
        },
      },
      success_url: `${frontendUrl}/dashboard/onboarding?welcome=true`,
      cancel_url: `${frontendUrl}/dashboard/billing?canceled=true`,
    })

    if (!session.url) {
      res.status(500).json({ error: 'Impossibile creare la sessione Stripe' })
      return
    }

    res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore Stripe sconosciuto'
    console.error('[checkout] Stripe session error:', message)
    res.status(500).json({ error: 'Errore durante la creazione del checkout', details: message })
  }
})
