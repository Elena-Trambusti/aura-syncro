/**
 * Barriera 3 — Hook RBAC per la UI.
 * Mirror di backend/src/lib/permissions.ts — la sicurezza reale è sempre sul server.
 *
 * @example
 * const { can, canAny, role } = usePermissions()
 * if (can('orders.pay')) { ... }
 */
import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  type AppRole,
  type Permission,
  normalizeRole,
  isKnownRole,
  hasPermission,
  hasAnyPermission,
  getPermissionsForRole,
  canSetOrderStatus,
  canUpdateOrderItemStatus,
} from '../lib/permissions'
import {
  canManageStaff,
  canAccessAdminNav,
  STAFF_MANAGE_ROLES,
  ADMIN_NAV_ROLES,
  ASSIGNABLE_STAFF_ROLES,
  hasRole,
} from '../lib/rbac'

export type { Permission, AppRole }

export function usePermissions() {
  const { user } = useAuth()

  return useMemo(() => {
    const role = normalizeRole(user?.role)
    const permissions = getPermissionsForRole(user?.role)
    const known = isKnownRole(user?.role)

    return {
      role,
      user,
      permissions,
      /** Ruolo riconosciuto dal sistema — se false, nessun permesso (fail-closed). */
      isKnownRole: known,

      /** Ha un singolo permesso? */
      can: (permission: Permission) => hasPermission(user?.role, permission),

      /** Ha almeno uno dei permessi (OR)? */
      canAny: (...perms: Permission[]) => hasAnyPermission(user?.role, ...perms),

      /** Ha almeno uno dei ruoli indicati? */
      hasRole: (...allowed: AppRole[]) => hasRole(user?.role, ...allowed),

      /** Ha tutti i permessi (AND)? */
      canAll: (...perms: Permission[]) => perms.every(p => hasPermission(user?.role, p)),

      canSetOrderStatus: (status: string) => canSetOrderStatus(user?.role, status),
      canUpdateOrderItemStatus: () => canUpdateOrderItemStatus(user?.role),
      canManageStaff: () => canManageStaff(user?.role),
      canAccessAdminNav: () => canAccessAdminNav(user?.role),

      isOwner: role === 'OWNER',
      isManager: role === 'MANAGER',
      isWaiter: role === 'WAITER',
      isChef: role === 'CHEF',

      staffManageRoles: STAFF_MANAGE_ROLES,
      adminNavRoles: ADMIN_NAV_ROLES,
      assignableStaffRoles: ASSIGNABLE_STAFF_ROLES,
    }
  }, [user])
}

/** Alias retrocompatibile — preferire usePermissions() nei nuovi componenti. */
export { usePermissions as default }
