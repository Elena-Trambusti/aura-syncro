import { Response, NextFunction } from 'express'
import { PlanTier } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'
import { tenantId, tenantNotFound } from '../lib/tenant'
import { isFreeTierApiPath } from './dashboardAccess'

export function isProPlanTier(planTier: PlanTier | string | null | undefined): boolean {
  const devProUnlock =
    process.env.NODE_ENV !== 'production'
    && process.env.PRO_PLAN_DEV_UNLOCK === 'true'
  return devProUnlock || planTier === 'PRO'
}

/** Premium €199/mo include tutti i moduli — abbonamento attivo = accesso completo. */
export function hasFullFeatureAccess(settings: {
  planTier?: PlanTier | null
  hasActiveSubscription?: boolean | null
} | null | undefined): boolean {
  const devProUnlock =
    process.env.NODE_ENV !== 'production'
    && process.env.PRO_PLAN_DEV_UNLOCK === 'true'
  if (devProUnlock) return true
  if (settings?.hasActiveSubscription === true) return true
  return isProPlanTier(settings?.planTier)
}

async function loadPlanSettings(req: AuthRequest) {
  return prisma.restaurant.findUnique({
    where: { id: tenantId(req) },
    select: { settings: { select: { planTier: true, hasActiveSubscription: true } } },
  })
}

/** Richiede abbonamento Premium attivo (tutti i moduli inclusi nel piano €199/mo). */
export async function requireProPlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const restaurant = await loadPlanSettings(req)
    if (!restaurant) {
      tenantNotFound(res, 'Ristorante non trovato')
      return
    }

    if (!hasFullFeatureAccess(restaurant.settings)) {
      if (req.freeTierPreview && isFreeTierApiPath(req.originalUrl)) {
        next()
        return
      }
      res.status(403).json({
        error: 'Abbonamento Premium richiesto per questa funzionalità.',
        code: 'PREMIUM_REQUIRED',
      })
      return
    }

    next()
  } catch {
    res.status(500).json({ error: 'Errore verifica piano' })
  }
}
