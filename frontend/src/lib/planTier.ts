import type { Restaurant } from '../contexts/AuthContext'

export type PlanTier = 'BASE' | 'PRO'

/** Moduli inclusi solo nel piano PRO */
export const PRO_MODULE_PATHS = [
  '/crm',
  '/dashboard/ai-predictive',
  '/marketing',
  '/report/fiscal',
  '/fedelta',
  '/analytics',
  '/pagamenti',
] as const

export function hasProPlan(restaurant: Restaurant | null | undefined): boolean {
  return restaurant?.planTier === 'PRO'
}

export function isProModulePath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/'
  return PRO_MODULE_PATHS.some(
    proPath => path === proPath || path.startsWith(`${proPath}/`),
  )
}

export function getPlanTierLabel(tier: PlanTier | undefined): string {
  return tier === 'PRO' ? 'Pro' : 'Base'
}
