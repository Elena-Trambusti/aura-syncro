import type { Restaurant } from '../contexts/AuthContext'

/** Tre stati tassativi di accesso alla dashboard */
export type AccessTier = 'unsubscribed' | 'onboarding' | 'operational'

export const BILLING_PATH = '/dashboard/billing'
export const ONBOARDING_PATH = '/dashboard/onboarding'
export const KITCHEN_DISPLAY_PATH = '/cucina'

/** Rotte accessibili senza abbonamento Premium (anteprima post-registrazione) */
export const FREE_TIER_NAV_PATHS = [
  '/dashboard',
  '/tavoli',
  '/prenotazioni',
  '/ordini',
  '/menu',
  '/pagamenti',
  '/report',
] as const

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

export function isFreeTierPath(pathname: string): boolean {
  const path = normalizePath(pathname)

  if (path === BILLING_PATH || path.startsWith(`${BILLING_PATH}/`)) return true
  if (path === ONBOARDING_PATH) return true // SBLOCCO TEMPORANEO PER TEST UTENTE
  if (path === '/dashboard') return true
  if (path === '/report') return true
  if (path.startsWith('/report/')) return false

  return FREE_TIER_NAV_PATHS.some(p => p !== '/dashboard' && p !== '/report' && (path === p || path.startsWith(`${p}/`)))
}

export function isFreeTierNavItem(to: string, exact?: boolean): boolean {
  if (to === '/dashboard') return true
  if (to === '/report') return exact === true
  return (FREE_TIER_NAV_PATHS as readonly string[]).includes(to)
}

/**
 * Restituisce la rotta di redirect obbligatorio, o `null` se il path è consentito.
 */
export function getAccessRedirect(tier: AccessTier, pathname: string): string | null {
  const path = normalizePath(pathname)

  // KDS fullscreen — sempre accessibile con permesso orders.read (non reindirizzare a onboarding/dashboard)
  if (path === KITCHEN_DISPLAY_PATH) return null

  if (tier === 'unsubscribed') {
    if (isFreeTierPath(path)) return null
    return '/dashboard'
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
