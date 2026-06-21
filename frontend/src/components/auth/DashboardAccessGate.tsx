import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAccessTier } from '../../hooks/useAccessTier'
import AuthLoadingScreen from './AuthLoadingScreen'

interface DashboardAccessGateProps {
  children: ReactNode
}

/**
 * SBARRAMENTO CENTRALE della dashboard Aura Syncro.
 *
 * Valuta i 3 stati tassativi del tenant (da /auth/me, già risolto lato server):
 * 1. unsubscribed  → anteprima free (dashboard, ordini, menu, pagamenti, report) + billing
 * 2. onboarding    → solo /dashboard/onboarding
 * 3. operational   → accesso completo (+ RBAC a valle)
 *
 * Non renderizza i figli finché isLoading è true, evitando flash di pagine protette.
 */
export default function DashboardAccessGate({ children }: DashboardAccessGateProps) {
  const { isLoading, getRedirect } = useAccessTier()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  const redirectTo = getRedirect(location.pathname)
  if (redirectTo) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
