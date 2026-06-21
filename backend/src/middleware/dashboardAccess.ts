import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'
import { tenantId, tenantNotFound } from '../lib/tenant'

function isPremiumActive(settings: { hasActiveSubscription?: boolean | null } | null | undefined): boolean {
  const devPremiumUnlock =
    process.env.NODE_ENV !== 'production'
    && process.env.PREMIUM_DEV_UNLOCK === 'true'
  return devPremiumUnlock || settings?.hasActiveSubscription === true
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
 * SBARRAMENTO CENTRALE API — mirror dei 3 stati frontend.
 * Richiede abbonamento attivo E setup concierge completato.
 */
export async function requireFullDashboardAccess(
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

    if (!isPremiumActive(restaurant.settings)) {
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
