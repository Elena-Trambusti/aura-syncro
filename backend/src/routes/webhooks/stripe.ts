import { Router, Request, Response } from 'express'
import { stripe, pickStripeWebhookSecret } from '../../lib/stripe'
import { handleCheckoutSessionCompleted } from '../../lib/stripeCheckoutWebhook'
import { handleCheckoutSessionExpired } from '../../lib/stripeCheckoutExpired'
import {
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
} from '../../lib/stripePaymentIntentWebhook'
import { syncRestaurantSubscriptionStatus } from '../../lib/stripeSubscriptionWebhook'
import { handleStripeInvoicePaid } from '../../lib/stripeInvoiceWebhook'
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookSucceeded,
} from '../../lib/stripeWebhookIdempotency'
import type {
  StripeCheckoutSessionPayload,
  StripeEventPayload,
  StripeInvoicePayload,
  StripeSubscriptionPayload,
  StripePaymentIntentPayload,
} from '../../lib/stripeTypes'
import { asyncHandler } from '../../lib/asyncHandler'

export const stripeWebhookRouter = Router()

async function resolveRestaurantIdFromEvent(event: StripeEventPayload): Promise<string | null> {
  const obj = event.data.object
  const metadata = obj.metadata as Record<string, string> | undefined

  if (metadata?.restaurantId) return metadata.restaurantId
  if (typeof obj.client_reference_id === 'string') return obj.client_reference_id

  return null
}

async function dispatchStripeEvent(event: StripeEventPayload): Promise<void> {
  if (event.type === 'checkout.session.completed') {
    await handleCheckoutSessionCompleted(event.data.object as StripeCheckoutSessionPayload)
    return
  }

  if (event.type === 'checkout.session.expired') {
    await handleCheckoutSessionExpired(event.data.object as StripeCheckoutSessionPayload)
    return
  }

  if (event.type === 'payment_intent.succeeded') {
    await handlePaymentIntentSucceeded(event.data.object as StripePaymentIntentPayload)
    return
  }

  if (event.type === 'payment_intent.payment_failed') {
    await handlePaymentIntentFailed(event.data.object as StripePaymentIntentPayload)
    return
  }

  if (
    event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as StripeSubscriptionPayload
    const result = await syncRestaurantSubscriptionStatus(subscription)

    if (result) {
      console.info(
        '[stripe-webhook] Abbonamento sincronizzato',
        result.restaurantId,
        result.status,
        result.hasActiveSubscription ? 'attivo' : 'disattivato',
      )
    }
    return
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as StripeInvoicePayload
    const subId = typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id

    if (subId) {
      const subscription = await stripe.subscriptions.retrieve(subId)
      const result = await syncRestaurantSubscriptionStatus({
        id: subscription.id,
        status: subscription.status,
        metadata: subscription.metadata as Record<string, string>,
      })
      if (result) {
        console.warn(
          '[stripe-webhook] Pagamento abbonamento fallito',
          result.restaurantId,
          subscription.status,
        )
      }
    }
    return
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    if (!event.livemode) {
      console.warn('[stripe-webhook] Evento fattura TEST ignorato (livemode=false)', {
        eventId: event.id,
        eventType: event.type,
      })
      return
    }

    const invoice = event.data.object as StripeInvoicePayload
    const result = await handleStripeInvoicePaid(invoice, event.id)

    if (result.processed) {
      console.info(`[stripe-webhook] ${event.type} elaborato`, {
        invoiceId: result.stripeInvoiceId,
        status: result.status,
      })
    }

    if (result.processed && result.status === 'failed' && result.retryable) {
      throw new Error(`Invio fattura elettronica fallito (retry): ${result.stripeInvoiceId}`)
    }
  }
}

/**
 * POST /api/webhooks/stripe
 * Notifiche Stripe: abbonamento SaaS, fatturazione elettronica, ordini guest e caparre.
 * Richiede body raw — vedi index.ts.
 */
stripeWebhookRouter.post('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = pickStripeWebhookSecret()

  if (!sig || typeof sig !== 'string') {
    res.status(400).json({ error: 'Header stripe-signature mancante' })
    return
  }

  if (!webhookSecret || webhookSecret.includes('inserisci')) {
    res.status(400).json({ error: 'Webhook secret Stripe non configurato' })
    return
  }

  let event: StripeEventPayload

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      webhookSecret,
    ) as unknown as StripeEventPayload
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firma non valida'
    console.error('[stripe-webhook] Verifica firma fallita:', message)
    res.status(400).json({ error: 'Firma webhook non valida' })
    return
  }

  const restaurantId = await resolveRestaurantIdFromEvent(event)
  const claim = await claimStripeWebhookEvent(event, restaurantId)

  if (claim.duplicate) {
    console.info('[stripe-webhook] Evento duplicato ignorato:', event.id, claim.status)
    res.status(200).json({ received: true, duplicate: true, status: claim.status })
    return
  }

  try {
    await dispatchStripeEvent(event)
    await markStripeWebhookSucceeded(event.id)
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] Errore elaborazione evento:', event.type, event.id, err)
    await markStripeWebhookFailed(event.id, err)
    res.status(500).json({ error: 'Errore interno webhook' })
  }
}))
