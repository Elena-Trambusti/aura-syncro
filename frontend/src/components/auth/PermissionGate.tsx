import type { ReactNode } from 'react'
import { type Permission } from '../../lib/permissions'
import { usePermissions } from '../../hooks/usePermissions'

interface PermissionGateProps {
  /** Permessi richiesti — basta uno (OR) salvo `requireAll`. */
  permissions: Permission[]
  /** Se true, servono TUTTI i permessi (AND). Default: false (OR). */
  requireAll?: boolean
  children: ReactNode
  /** Contenuto alternativo se negato — default: null (nasconde). */
  fallback?: ReactNode
}

/**
 * Barriera 3 — Nasconde sezioni UI se l'utente non ha i permessi.
 * Non sostituisce i guard sulle route né i controlli API.
 *
 * @example
 * <PermissionGate permissions={['orders.pay']}>
 *   <button>Incassa</button>
 * </PermissionGate>
 */
export default function PermissionGate({
  permissions,
  requireAll = false,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { canAny, canAll } = usePermissions()

  const allowed = requireAll ? canAll(...permissions) : canAny(...permissions)

  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
