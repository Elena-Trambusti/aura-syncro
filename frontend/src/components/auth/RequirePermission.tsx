import type { ReactNode } from 'react'
import { type Permission } from '../../lib/permissions'
import { useRole } from '../../hooks/useRole'
import AccessDenied from '../AccessDenied'

interface RequirePermissionProps {
  permissions: Permission[]
  children: ReactNode
  fallback?: ReactNode
}

/** Blocca il render se l'utente non ha almeno uno dei permessi richiesti */
export default function RequirePermission({ permissions, children, fallback }: RequirePermissionProps) {
  const { canAny } = useRole()

  if (!canAny(...permissions)) {
    return fallback ?? <AccessDenied />
  }

  return <>{children}</>
}
