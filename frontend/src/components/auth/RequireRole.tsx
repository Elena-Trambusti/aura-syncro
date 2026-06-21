import type { ReactNode } from 'react'
import { type AppRole } from '../../lib/rbac'
import { useRole } from '../../hooks/useRole'
import AccessDenied from '../AccessDenied'

interface RequireRoleProps {
  roles: AppRole[]
  children: ReactNode
  fallback?: ReactNode
}

/** Blocca il render se l'utente non ha uno dei ruoli richiesti */
export default function RequireRole({ roles, children, fallback }: RequireRoleProps) {
  const { hasRole } = useRole()

  if (!hasRole(...roles)) {
    return fallback ?? <AccessDenied />
  }

  return <>{children}</>
}
