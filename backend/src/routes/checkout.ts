import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { stripe, STRIPE_ENABLED } from '../lib/stripe'
import { AuthRequest } from '../middleware/auth'

export const checkoutRouter = Router()

const SETUP_AMOUNT_CENTS = 50_000
const SUBSCRIPTION_AMOUNT_CENTS = 19_900

function resolveFrontendUrl(): string {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5173'
  return raw.split(',')[0].trim().replace(/\/$/, '')
}

/** POST /api/checkout — Stripe Checkout Session (setup + abbonamento SaaS) */
checkoutRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
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

  const frontendUrl = resolveFrontendUrl()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Setup Iniziale Aura Syncro',
              description: 'Configurazione iniziale una tantum della piattaforma',
            },
            unit_amount: SETUP_AMOUNT_CENTS,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Abbonamento Premium',
              description: 'Accesso completo ad Aura Syncro',
            },
            unit_amount: SUBSCRIPTION_AMOUNT_CENTS,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
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
      success_url: `${frontendUrl}/dashboard/billing?success=true`,
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
