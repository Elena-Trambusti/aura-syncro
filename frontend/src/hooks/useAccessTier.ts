import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  type AccessTier,
  resolveAccessTier,
  getAccessRedirect,
  isPathAllowedForTier,
  BILLING_PATH,
  ONBOARDING_PATH,
} from '../lib/accessTier'

export function useAccessTier() {
  const { restaurant, isLoading } = useAuth()

  return useMemo(() => {
    const tier = resolveAccessTier(restaurant)
    return {
      tier,
      isLoading,
      restaurant,
      isUnsubscribed: tier === 'unsubscribed',
      isOnboarding: tier === 'onboarding',
      isOperational: tier === 'operational',
      billingPath: BILLING_PATH,
      onboardingPath: ONBOARDING_PATH,
      getRedirect: (pathname: string) => getAccessRedirect(tier, pathname),
      isPathAllowed: (pathname: string) => isPathAllowedForTier(tier, pathname),
    }
  }, [restaurant, isLoading])
}

export type { AccessTier }
