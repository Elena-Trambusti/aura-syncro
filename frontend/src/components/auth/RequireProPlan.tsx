import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePlanTier } from '../../hooks/usePlanTier'
import { useAccessTier } from '../../hooks/useAccessTier'
import { isFreeTierPath } from '../../lib/accessTier'
import ProPaywall from '../ProPaywall'

interface RequireProPlanProps {
  children: ReactNode
}

/** Blocca moduli avanzati se il tenant è sul piano BASE (anteprima free tier esclusa). */
export default function RequireProPlan({ children }: RequireProPlanProps) {
  const { hasProPlan } = usePlanTier()
  const { tier } = useAccessTier()
  const location = useLocation()

  if (tier === 'unsubscribed' && isFreeTierPath(location.pathname)) {
    return <>{children}</>
  }

  if (!hasProPlan) {
    return <ProPaywall />
  }

  return <>{children}</>
}
