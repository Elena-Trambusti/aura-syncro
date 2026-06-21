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

async function loadPlanTier(req: AuthRequest): Promise<PlanTier | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: tenantId(req) },
    select: { settings: { select: { planTier: true } } },
  })
  if (!restaurant) return null
  return restaurant.settings?.planTier ?? PlanTier.BASE
}

/** Richiede piano PRO per moduli avanzati (CRM, AI, marketing, fiscal…). */
export async function requireProPlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const planTier = await loadPlanTier(req)
    if (planTier === null) {
      tenantNotFound(res, 'Ristorante non trovato')
      return
    }

    if (!isProPlanTier(planTier)) {
      if (req.freeTierPreview && isFreeTierApiPath(req.originalUrl)) {
        next()
        return
      }
      res.status(403).json({
        error: 'Piano Pro richiesto per questa funzionalità.',
        code: 'PRO_PLAN_REQUIRED',
      })
      return
    }

    next()
  } catch {
    res.status(500).json({ error: 'Errore verifica piano' })
  }
}
