import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { hasProPlan, type PlanTier } from '../lib/planTier'

export function usePlanTier() {
  const { restaurant } = useAuth()

  return useMemo(() => ({
    planTier: (restaurant?.planTier ?? 'BASE') as PlanTier,
    hasProPlan: hasProPlan(restaurant),
    isBasePlan: restaurant?.planTier !== 'PRO',
  }), [restaurant])
}
