import type { Restaurant } from '../contexts/AuthContext'

/** Tre stati tassativi di accesso alla dashboard */
export type AccessTier = 'unsubscribed' | 'onboarding' | 'operational'

export const BILLING_PATH = '/dashboard/billing'
export const ONBOARDING_PATH = '/dashboard/onboarding'

export function resolveAccessTier(restaurant: Restaurant | null | undefined): AccessTier {
  if (!restaurant?.hasActiveSubscription) return 'unsubscribed'
  if (!restaurant?.isSetupComplete) return 'onboarding'
  return 'operational'
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

/**
 * Restituisce la rotta di redirect obbligatorio, o `null` se il path è consentito.
 */
export function getAccessRedirect(tier: AccessTier, pathname: string): string | null {
  const path = normalizePath(pathname)

  if (tier === 'unsubscribed') {
    if (path === BILLING_PATH) return null
    return BILLING_PATH
  }

  if (tier === 'onboarding') {
    if (path === ONBOARDING_PATH) return null
    return ONBOARDING_PATH
  }

  return null
}

export function isPathAllowedForTier(tier: AccessTier, pathname: string): boolean {
  return getAccessRedirect(tier, pathname) === null
}
