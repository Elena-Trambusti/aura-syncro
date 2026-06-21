import type { ReactNode } from 'react'
import { usePlanTier } from '../../hooks/usePlanTier'
import ProPaywall from '../ProPaywall'

interface RequireProPlanProps {
  children: ReactNode
}

/** Blocca moduli avanzati se il tenant è sul piano BASE. */
export default function RequireProPlan({ children }: RequireProPlanProps) {
  const { hasProPlan } = usePlanTier()

  if (!hasProPlan) {
    return <ProPaywall />
  }

  return <>{children}</>
}
