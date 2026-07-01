import { getAllowedOrigins, isOriginAllowed } from './cors'

/** Origine frontend sicura per redirect Stripe Connect e link email. */
export function resolveFrontendOrigin(requestOrigin?: string | string[]): string {
  const origin = Array.isArray(requestOrigin) ? requestOrigin[0] : requestOrigin
  if (origin && isOriginAllowed(origin)) {
    return origin.replace(/\/$/, '')
  }

  const preferred =
    getAllowedOrigins().find(o => o === 'https://www.aurasyncro.com')
    ?? getAllowedOrigins().find(o => o.startsWith('https://'))
    ?? 'https://www.aurasyncro.com'

  return preferred.replace(/\/$/, '')
}
