import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { stripe, STRIPE_ENABLED } from '../lib/stripe'
import { AuthRequest, requireRole } from '../middleware/auth'
import { resolvePrimaryFrontendUrl } from '../lib/frontendUrl'
import { z } from 'zod'

export const checkoutRouter = Router()

function resolveStripePriceIds(plan: 'STARTER' | 'PREMIUM'): { setup: string; subscription: string } | null {
  if (plan === 'STARTER') {
    const setup = process.env.STRIPE_PRICE_STARTER_SETUP?.trim()
    const subscription = process.env.STRIPE_PRICE_STARTER_SUBSCRIPTION?.trim()
    if (!setup || !subscription) return null
    return { setup, subscription }
  } else {
    const setup = process.env.STRIPE_PRICE_PREMIUM_SETUP?.trim() || process.env.STRIPE_PRICE_SETUP?.trim()
    const subscription = process.env.STRIPE_PRICE_PREMIUM_SUBSCRIPTION?.trim() || process.env.STRIPE_PRICE_SUBSCRIPTION?.trim()
    if (!setup || !subscription) return null
    return { setup, subscription }
  }
}

/** POST /api/checkout — Stripe Checkout Session (setup €500 + abbonamento €199/mo, tutto incluso) */
checkoutRouter.post('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    plan: z.enum(['STARTER', 'PREMIUM']).default('PREMIUM')
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Piano non valido' })
    return
  }
  const plan = parsed.data.plan

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

  const stripePrices = resolveStripePriceIds(plan)
  if (!stripePrices) {
    res.status(503).json({
      error: `Prezzi Stripe non configurati per il piano ${plan}. Assicurati di aver impostato le variabili d'ambiente corrette in backend/.env`,
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
        plan,
      },
      subscription_data: {
        metadata: {
          restaurantId,
          userId,
          plan,
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

/** POST /api/checkout/portal — Stripe Customer Portal (gestione abbonamento / fatture) */
checkoutRouter.post('/portal', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!STRIPE_ENABLED) {
    res.status(503).json({ error: 'Stripe non configurato' })
    return
  }

  const restaurantId = req.restaurantId
  if (!restaurantId) {
    res.status(401).json({ error: 'Autenticazione richiesta' })
    return
  }

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
    select: { stripeCustomerId: true },
  })

  if (!settings?.stripeCustomerId) {
    res.status(400).json({
      error: 'Nessun abbonamento Stripe collegato a questo ristorante',
      code: 'NO_STRIPE_CUSTOMER',
    })
    return
  }

  const frontendUrl = resolvePrimaryFrontendUrl()

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: settings.stripeCustomerId,
      return_url: `${frontendUrl}/dashboard/billing`,
    })

    if (!session.url) {
      res.status(500).json({ error: 'Impossibile aprire il portale Stripe' })
      return
    }

    res.json({ portalUrl: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore Stripe sconosciuto'
    console.error('[checkout/portal] Stripe portal error:', message)
    res.status(500).json({ error: 'Errore durante l\'apertura del portale Stripe', details: message })
  }
})
