import { Router, Request, Response } from 'express'
import { stripe } from '../../lib/stripe'
import {
  activateRestaurantSubscription,
  syncRestaurantSubscriptionStatus,
} from '../../lib/stripeSubscriptionWebhook'

export const stripeWebhookRouter = Router()

/**
 * POST /api/webhooks/stripe
 * Notifiche Stripe (abbonamento SaaS). Richiede body raw — vedi index.ts.
 */
stripeWebhookRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || typeof sig !== 'string') {
    res.status(400).json({ error: 'Header stripe-signature mancante' })
    return
  }

  if (!webhookSecret || webhookSecret.includes('inserisci')) {
    res.status(400).json({ error: 'STRIPE_WEBHOOK_SECRET non configurato' })
    return
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      webhookSecret,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma non valida'
    console.error('[stripe-webhook] Verifica firma fallita:', message)
    res.status(400).json({ error: 'Firma webhook non valida' })
    return
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const result = await activateRestaurantSubscription(session)

      if (result) {
        console.info(
          '[stripe-webhook] Premium attivato',
          result.restaurantId,
          result.stripeSubscriptionId ?? '(no subscription id)',
        )
      }
    }

    if (
      event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as { id: string; status: string; metadata?: Record<string, string> }
      const result = await syncRestaurantSubscriptionStatus(subscription)

      if (result) {
        console.info(
          '[stripe-webhook] Abbonamento sincronizzato',
          result.restaurantId,
          result.status,
          result.hasActiveSubscription ? 'attivo' : 'disattivato',
        )
      }
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] Errore elaborazione evento:', err)
    res.status(500).json({ error: 'Errore interno webhook' })
  }
})
