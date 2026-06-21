/** Base URL Stripe Dashboard (Live in produzione, Test in dev). */
export function stripeDashboardBase(): string {
  const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ''
  if (pk.startsWith('pk_live_')) return 'https://dashboard.stripe.com'
  if (pk.startsWith('pk_test_')) return 'https://dashboard.stripe.com/test'
  return import.meta.env.PROD
    ? 'https://dashboard.stripe.com'
    : 'https://dashboard.stripe.com/test'
}

export function stripePaymentsUrl(): string {
  return `${stripeDashboardBase()}/payments`
}

export function stripeApiKeysUrl(): string {
  return `${stripeDashboardBase()}/apikeys`
}
