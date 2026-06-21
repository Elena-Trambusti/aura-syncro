/** Ruoli applicativi Aura Syncro (allineati a Prisma enum Role) */
export type AppRole = 'OWNER' | 'MANAGER' | 'WAITER' | 'CHEF'

export const ROLES: AppRole[] = ['OWNER', 'MANAGER', 'WAITER', 'CHEF']

export const STAFF_MANAGE_ROLES: AppRole[] = ['OWNER', 'MANAGER']

/** Voci sidebar riservate a titolari e manager */
export const ADMIN_NAV_ROLES: AppRole[] = ['OWNER', 'MANAGER']

export function normalizeRole(role: string | undefined | null): AppRole {
  if (role === 'KITCHEN') return 'CHEF'
  if (role === 'CASHIER') return 'WAITER'
  if (role && ROLES.includes(role as AppRole)) return role as AppRole
  return 'WAITER'
}

export function hasRole(userRole: string | undefined | null, ...allowed: AppRole[]): boolean {
  return allowed.includes(normalizeRole(userRole))
}

export function canManageStaff(userRole: string | undefined | null): boolean {
  return hasRole(userRole, ...STAFF_MANAGE_ROLES)
}

export function canAccessAdminNav(userRole: string | undefined | null): boolean {
  return hasRole(userRole, ...ADMIN_NAV_ROLES)
}

/** Ruoli assegnabili quando si crea un dipendente (non OWNER) */
export const ASSIGNABLE_STAFF_ROLES: AppRole[] = ['MANAGER', 'WAITER', 'CHEF']
