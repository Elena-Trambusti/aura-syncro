import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  type AppRole,
  normalizeRole,
  hasRole,
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
      hasRole: (...allowed: AppRole[]) => hasRole(user?.role, ...allowed),
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
