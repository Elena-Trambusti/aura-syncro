/** URL frontend canonico per redirect Stripe, email reset password, ecc. */
export function resolvePrimaryFrontendUrl(): string {
  const fromEnv = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  const nonLocal = fromEnv.find((o) => !/^https?:\/\/localhost(\b|:)/i.test(o))
  const primary = nonLocal || fromEnv[0] || 'https://aurasyncro.com'
  return primary.replace(/\/$/, '')
}
