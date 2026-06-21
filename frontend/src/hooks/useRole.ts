import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  type AppRole,
  type Permission,
  normalizeRole,
  hasRole,
  hasPermission,
  hasAnyPermission,
  getPermissionsForRole,
  canSetOrderStatus,
  canUpdateOrderItemStatus,
  canManageStaff,
  canAccessAdminNav,
  STAFF_MANAGE_ROLES,
  ADMIN_NAV_ROLES,
  ASSIGNABLE_STAFF_ROLES,
} from '../lib/rbac'

export function useRole() {
  const { user } = useAuth()

  return useMemo(() => {
    const role = normalizeRole(user?.role)

    return {
      role,
      user,
      permissions: getPermissionsForRole(user?.role),
      hasRole: (...allowed: AppRole[]) => hasRole(user?.role, ...allowed),
      can: (permission: Permission) => hasPermission(user?.role, permission),
      canAny: (...permissions: Permission[]) => hasAnyPermission(user?.role, ...permissions),
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
