import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'
import { tenantId, tenantNotFound } from '../lib/tenant'

/** API raggiungibili in anteprima free (tenant registrato, senza abbonamento) */
export const FREE_TIER_API_PREFIXES = [
  '/api/analytics',
  '/api/orders',
  '/api/menu',
  '/api/reports',
  '/api/payments',
  '/api/push',
] as const

function isPremiumActive(settings: { hasActiveSubscription?: boolean | null } | null | undefined): boolean {
  const devPremiumUnlock =
    process.env.NODE_ENV !== 'production'
    && process.env.PREMIUM_DEV_UNLOCK === 'true'
  return devPremiumUnlock || settings?.hasActiveSubscription === true
}

export function isFreeTierApiPath(originalUrl: string): boolean {
  const path = originalUrl.split('?')[0]
  if (path.startsWith('/api/payments/overview')) return false
  if (path.startsWith('/api/reports/fiscal')) return false
  return FREE_TIER_API_PREFIXES.some(prefix => path.startsWith(prefix))
}

async function loadTenantAccess(req: AuthRequest) {
  return prisma.restaurant.findUnique({
    where: { id: tenantId(req) },
    select: {
      isSetupComplete: true,
      settings: { select: { hasActiveSubscription: true } },
    },
  })
}

/**
 * Accesso dashboard/API con supporto anteprima free tier.
 * - operational: abbonamento attivo + setup completato
 * - free preview: senza abbonamento, solo rotte FREE_TIER_API_PREFIXES
 */
export async function requireDashboardAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const restaurant = await loadTenantAccess(req)

    if (!restaurant) {
      tenantNotFound(res, 'Ristorante non trovato')
      return
    }

    const premium = isPremiumActive(restaurant.settings)

    if (premium && restaurant.isSetupComplete) {
      req.freeTierPreview = false
      next()
      return
    }

    if (!premium && isFreeTierApiPath(req.originalUrl)) {
      req.freeTierPreview = true
      next()
      return
    }

    if (!premium) {
      res.status(403).json({
        error: 'Abbonamento attivo richiesto. Attiva Aura Syncro Premium.',
        code: 'SUBSCRIPTION_REQUIRED',
      })
      return
    }

    if (!restaurant.isSetupComplete) {
      res.status(403).json({
        error: 'Onboarding concierge in corso. Attendi il completamento della configurazione.',
        code: 'ONBOARDING_REQUIRED',
      })
      return
    }

    next()
  } catch {
    res.status(500).json({ error: 'Errore verifica accesso dashboard' })
  }
}

/** @deprecated Usare requireDashboardAccess */
export const requireFullDashboardAccess = requireDashboardAccess
