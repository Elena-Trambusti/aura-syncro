import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { buildFiscalConfig, fiscalConfigPayload } from './taxEngine'

/** Extract tenant ID from authenticated request — throws if missing. */
export function tenantId(req: AuthRequest): string {
  if (!req.restaurantId) throw new Error('Tenant ID mancante nel contesto della richiesta')
  return req.restaurantId
}

/** Prisma `where` clause scoped to the current tenant. */
export function tenantWhere(req: AuthRequest) {
  return { restaurantId: tenantId(req) }
}

/** Prisma `where` for a resource ID within the current tenant. */
export function scopedWhere(req: AuthRequest, id: string) {
  return { id, restaurantId: tenantId(req) }
}

export function tenantNotFound(res: Response, message = 'Risorsa non trovata'): void {
  res.status(404).json({ error: message })
}

export function tenantForbidden(res: Response, message = 'Accesso al tenant non autorizzato'): void {
  res.status(403).json({ error: message })
}

type RestaurantWithSettings = {
  id: string
  name: string
  slug: string
  colorTheme?: string | null
  logoUrl?: string | null
  logo?: string | null
  timezone?: string | null
  isSetupComplete?: boolean | null
  settings?: {
    countryCode?: import('@prisma/client').CountryCode | null
    taxRegion?: import('@prisma/client').TaxRegion | null
    taxRate?: number | null
    defaultLocale?: string | null
    taxId?: string | null
    hasActiveSubscription?: boolean | null
    stripeSubscriptionId?: string | null
    planTier?: import('@prisma/client').PlanTier | null
  } | null
}

/** Standard restaurant payload for auth responses. */
export function restaurantPayload(restaurant: RestaurantWithSettings) {
  const fiscal = buildFiscalConfig(restaurant.settings)
  const devPremiumUnlock =
    process.env.NODE_ENV !== 'production'
    && process.env.PREMIUM_DEV_UNLOCK === 'true'

  const dbSubscriptionActive = restaurant.settings?.hasActiveSubscription === true
  const devProUnlock =
    process.env.NODE_ENV !== 'production'
    && process.env.PRO_PLAN_DEV_UNLOCK === 'true'
  const dbPlanTier = restaurant.settings?.planTier ?? 'BASE'

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    colorTheme: restaurant.colorTheme || '#c9a227',
    logoUrl: restaurant.logoUrl ?? restaurant.logo ?? null,
    ...fiscalConfigPayload(fiscal, restaurant.settings?.taxId),
    timezone: restaurant.timezone ?? fiscal.timezone,
    hasActiveSubscription: devPremiumUnlock || dbSubscriptionActive,
    isSetupComplete: restaurant.isSetupComplete === true,
    planTier: devProUnlock ? 'PRO' : dbPlanTier,
  }
}
