import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { stripe, STRIPE_ENABLED } from '../lib/stripe'
import { AuthRequest, requireRole } from '../middleware/auth'

export const checkoutRouter = Router()

const PRO_MONTHLY_AMOUNT_CENTS = 7_900

function resolveStripePriceIds(): { setup: string; subscription: string } | null {
  const setup = process.env.STRIPE_PRICE_SETUP?.trim()
  const subscription = process.env.STRIPE_PRICE_SUBSCRIPTION?.trim()
  if (!setup || !subscription) return null
  return { setup, subscription }
}

function resolveFrontendUrl(): string {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173'
  return raw.split(',')[0].trim().replace(/\/$/, '')
}

/** POST /api/checkout — Stripe Checkout Session (setup + abbonamento SaaS) */
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

  const frontendUrl = resolveFrontendUrl()

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

/** POST /api/checkout/pro — Upgrade mensile al piano Pro (richiede Premium attivo) */
checkoutRouter.post('/pro', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
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

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: { select: { hasActiveSubscription: true, planTier: true } } },
  })

  if (!restaurant?.settings?.hasActiveSubscription) {
    res.status(403).json({
      error: 'Attiva prima Aura Syncro Premium per passare al piano Pro.',
      code: 'PREMIUM_REQUIRED',
    })
    return
  }

  if (restaurant.settings.planTier === 'PRO') {
    res.status(400).json({ error: 'Il piano Pro è già attivo.', code: 'ALREADY_PRO' })
    return
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, restaurantId },
    select: { email: true },
  })

  if (!user) {
    res.status(404).json({ error: 'Utente non trovato' })
    return
  }

  const frontendUrl = resolveFrontendUrl()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      client_reference_id: restaurantId,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Aura Syncro Pro',
              description: 'CRM, AI predittiva, marketing, report fiscal e analytics avanzate',
            },
            unit_amount: PRO_MONTHLY_AMOUNT_CENTS,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      metadata: {
        restaurantId,
        userId,
        plan: 'pro',
      },
      subscription_data: {
        metadata: {
          restaurantId,
          userId,
          plan: 'pro',
        },
      },
      success_url: `${frontendUrl}/dashboard/billing?pro_success=true`,
      cancel_url: `${frontendUrl}/dashboard/billing?pro_canceled=true`,
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
    console.error('[checkout/pro] Stripe session error:', message)
    res.status(500).json({ error: 'Errore durante la creazione del checkout Pro', details: message })
  }
})
