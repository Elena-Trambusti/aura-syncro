/**
 * Verifica configurazione Stripe (prezzi, webhook, checkout, account).
 * Uso: npx tsx scripts/verify-stripe.ts [--ping-webhook]
 */
import dotenv from 'dotenv'
import Stripe from 'stripe'

dotenv.config()

const DO_WEBHOOK_URL = 'https://aura-syncro-s98ae.ondigitalocean.app/api/webhooks/stripe'
const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const

function fail(msg: string): never {
  console.error('❌', msg)
  process.exit(1)
}

function warn(msg: string) {
  console.warn('⚠️ ', msg)
}

function ok(msg: string) {
  console.log('✅', msg)
}

async function main() {
  const pingWebhook = process.argv.includes('--ping-webhook')
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  const setupPrice = process.env.STRIPE_PRICE_SETUP?.trim()
  const subPrice = process.env.STRIPE_PRICE_SUBSCRIPTION?.trim()

  if (!secretKey || secretKey.includes('inserisci')) {
    fail('STRIPE_SECRET_KEY mancante in backend/.env')
  }

  const mode = secretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'
  console.log(`\n=== Stripe audit (${mode}) ===\n`)

  const stripe = new Stripe(secretKey)

  try {
    const acct = await stripe.accounts.retrieve()
    ok(`Account Stripe: ${acct.country ?? 'N/A'}`)
    if (!acct.charges_enabled) warn('charges_enabled=false — completa onboarding Stripe prima del Live')
    else ok('charges_enabled=true')
    if (!acct.payouts_enabled) warn('payouts_enabled=false — collega IBAN su Stripe')
    else ok('payouts_enabled=true')
    if (!acct.details_submitted) warn('details_submitted=false — verifica identità/azienda su Stripe Dashboard')
    else ok('details_submitted=true')
  } catch (err) {
    warn(`Impossibile leggere account: ${err instanceof Error ? err.message : err}`)
  }

  if (!setupPrice || !subPrice) {
    fail('STRIPE_PRICE_SETUP e STRIPE_PRICE_SUBSCRIPTION richiesti in backend/.env')
  }

  for (const [label, id] of [['setup', setupPrice], ['subscription', subPrice]] as const) {
    const price = await stripe.prices.retrieve(id!)
    const amount = (price.unit_amount ?? 0) / 100
    if (!price.active) fail(`Prezzo ${label} non attivo: ${id}`)
    ok(`Prezzo ${label}: ${amount} EUR (${price.type}${price.recurring ? `/${price.recurring.interval}` : ''})`)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: 'verify-stripe@aura-syncro.local',
    line_items: [
      { price: setupPrice, quantity: 1 },
      { price: subPrice, quantity: 1 },
    ],
    success_url: 'https://example.com/s',
    cancel_url: 'https://example.com/c',
    metadata: { restaurantId: 'verify-stripe', plan: 'premium' },
    subscription_data: { metadata: { restaurantId: 'verify-stripe', plan: 'premium' } },
  })
  const expanded = await stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items'] })
  const total = (expanded.amount_total ?? 0) / 100
  if (total !== 699) warn(`Totale checkout atteso 699 EUR, ottenuto ${total} EUR`)
  else ok(`Checkout session: ${total} EUR (500 setup + 199 primo mese)`)
  await stripe.checkout.sessions.expire(session.id)

  const hooks = await stripe.webhookEndpoints.list({ limit: 20 })
  const primary = hooks.data.find(h => h.url === DO_WEBHOOK_URL)
  if (!primary) {
    fail(`Nessun webhook su ${DO_WEBHOOK_URL}. Esegui: npx tsx scripts/sync-stripe-webhooks.ts`)
  }
  ok(`Webhook: ${primary.url}`)
  for (const ev of REQUIRED_EVENTS) {
    if (!primary.enabled_events.includes(ev)) fail(`Webhook manca evento: ${ev}`)
  }
  ok(`Eventi webhook: ${REQUIRED_EVENTS.join(', ')}`)

  if (!webhookSecret || webhookSecret.includes('inserisci')) {
    warn('STRIPE_WEBHOOK_SECRET non configurato localmente')
  } else {
    ok('STRIPE_WEBHOOK_SECRET configurato')
  }

  if (pingWebhook && webhookSecret) {
    const payload = JSON.stringify({
      id: 'evt_verify_stripe',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_verify',
          mode: 'subscription',
          payment_status: 'paid',
          metadata: { restaurantId: 'non-esiste', plan: 'premium' },
          client_reference_id: 'non-esiste',
          subscription: 'sub_verify',
        },
      },
    })
    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    })
    const res = await fetch(DO_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
      body: payload,
    })
    const body = await res.text()
    if (res.status === 200) ok(`Webhook produzione risponde 200 (${body.slice(0, 80)})`)
    else warn(`Webhook produzione HTTP ${res.status}: ${body}`)
  }

  console.log('\n=== Live checklist ===')
  if (mode === 'TEST') {
    console.log('• Passa Stripe Dashboard in modalità Live')
    console.log('• Aggiorna su DigitalOcean: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY')
    console.log('• Crea prezzi Live e aggiorna STRIPE_PRICE_SETUP / STRIPE_PRICE_SUBSCRIPTION')
    console.log('• Crea webhook Live →', DO_WEBHOOK_URL)
    console.log('• Aggiorna STRIPE_WEBHOOK_SECRET con whsec_ del webhook Live')
  }
  console.log('• Completa verifica account + IBAN su Stripe')
  console.log('• Test end-to-end: registrazione → billing → pagamento → webhook 200\n')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
