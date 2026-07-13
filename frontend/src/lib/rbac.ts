/** Ruoli applicativi Aura Syncro (allineati a Prisma enum Role) */
export type { AppRole, Permission } from './permissions'
export {
  normalizeRole,
  hasPermission,
  hasAnyPermission,
  getPermissionsForRole,
  canSetOrderStatus,
  canUpdateOrderItemStatus,
} from './permissions'

import { type AppRole, normalizeRole, hasPermission } from './permissions'

export const ROLES: AppRole[] = ['OWNER', 'MANAGER', 'WAITER', 'CHEF', 'BARTENDER', 'HOST']

export const STAFF_MANAGE_ROLES: AppRole[] = ['OWNER', 'MANAGER']

/** Operazioni riservate al titolare (billing, fiscale, impostazioni tenant) */
export const OWNER_ONLY_ROLES: AppRole[] = ['OWNER']

/** Voci sidebar riservate a titolari e manager */
export const ADMIN_NAV_ROLES: AppRole[] = ['OWNER', 'MANAGER']

export function hasRole(userRole: string | undefined | null, ...allowed: AppRole[]): boolean {
  return allowed.includes(normalizeRole(userRole))
}

export function canManageStaff(userRole: string | undefined | null): boolean {
  return hasPermission(userRole, 'staff.manage')
}

export function canAccessAdminNav(userRole: string | undefined | null): boolean {
  return hasRole(userRole, ...ADMIN_NAV_ROLES)
}

/** Ruoli assegnabili quando si crea un dipendente (non OWNER) */
export const ASSIGNABLE_STAFF_ROLES: AppRole[] = ['MANAGER', 'WAITER', 'CHEF', 'BARTENDER', 'HOST']
