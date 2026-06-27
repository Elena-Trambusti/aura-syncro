import Stripe from 'stripe'

function pickStripeSecretKey(): string {
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && process.env.STRIPE_LIVE_SECRET_KEY?.trim()) {
    return process.env.STRIPE_LIVE_SECRET_KEY.trim()
  }
  return process.env.STRIPE_SECRET_KEY?.trim() || 'sk_test_placeholder'
}

export function pickStripeWebhookSecret(): string {
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd && process.env.STRIPE_LIVE_WEBHOOK_SECRET?.trim()) {
    return process.env.STRIPE_LIVE_WEBHOOK_SECRET.trim()
  }
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || ''
}

const STRIPE_SECRET_KEY = pickStripeSecretKey()

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia',
})

export const STRIPE_ENABLED = !!(
  STRIPE_SECRET_KEY &&
  !STRIPE_SECRET_KEY.includes('inserisci')
)

/** Commissione piattaforma del 2% su ogni transazione pagata tramite Stripe Connect */
export const STRIPE_APPLICATION_FEE_PCT = 0.02
