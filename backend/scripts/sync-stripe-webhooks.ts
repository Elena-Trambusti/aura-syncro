/**
 * Allinea webhook Stripe all'endpoint DigitalOcean (un solo endpoint unificato).
 * Uso: npx tsx scripts/sync-stripe-webhooks.ts
 */
import dotenv from 'dotenv'
import Stripe from 'stripe'

dotenv.config()

const WEBHOOK_URL = 'https://aura-syncro-s98ae.ondigitalocean.app/api/webhooks/stripe'
const EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
] as const

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY mancante')

  const stripe = new Stripe(key)
  const hooks = await stripe.webhookEndpoints.list({ limit: 20 })

  let primary = hooks.data.find(h => h.url === WEBHOOK_URL)
  if (primary) {
    primary = await stripe.webhookEndpoints.update(primary.id, {
      enabled_events: [...EVENTS],
      disabled: false,
      description: 'Aura Syncro — abbonamenti, ordini guest, caparre',
    })
    console.log('Webhook aggiornato:', primary.id, primary.url)
  } else {
    primary = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: [...EVENTS],
      description: 'Aura Syncro — abbonamenti, ordini guest, caparre',
    })
    console.log('Webhook creato:', primary.id, primary.url)
    console.log('\n⚠️  Nuovo signing secret — aggiorna STRIPE_WEBHOOK_SECRET su DigitalOcean:')
    console.log(primary.secret)
  }

  for (const h of hooks.data) {
    if (h.id === primary.id) continue
    if (h.url.includes('vercel.app') || h.url.includes('ondigitalocean.app')) {
      await stripe.webhookEndpoints.del(h.id)
      console.log('Rimosso webhook duplicato:', h.id, h.url)
    }
  }

  console.log('\nEventi:', primary.enabled_events.join(', '))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
