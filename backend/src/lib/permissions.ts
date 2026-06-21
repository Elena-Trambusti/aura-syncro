/** Ruoli applicativi (allineati a Prisma enum Role) */
export type AppRole = 'OWNER' | 'MANAGER' | 'WAITER' | 'CHEF'

export const PERMISSIONS = [
  'tables.read',
  'tables.manage',
  'tables.status',
  'orders.read',
  'orders.create',
  'orders.items',
  'orders.status',
  'orders.kitchen_status',
  'orders.cancel',
  'orders.pay',
  'menu.read',
  'menu.manage',
  'menu.availability',
  'reservations.read',
  'reservations.manage',
  'inventory.read',
  'inventory.manage',
  'staff.manage',
  'settings.manage',
  'reports.read',
  'payments.overview',
  'customers.read',
  'customers.manage',
  'loyalty.manage',
  'marketing.manage',
  'analytics.read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL_PERMISSIONS = new Set<Permission>(PERMISSIONS)

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  OWNER: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS,
  WAITER: new Set<Permission>([
    'tables.read',
    'tables.status',
    'orders.read',
    'orders.create',
    'orders.items',
    'orders.status',
    'orders.cancel',
    'menu.read',
    'menu.availability',
    'reservations.read',
    'reservations.manage',
    'inventory.read',
    'reports.read',
  ]),
  CHEF: new Set<Permission>([
    'orders.read',
    'orders.items',
    'orders.kitchen_status',
    'menu.read',
    'menu.availability',
    'inventory.read',
  ]),
}

export const WAITER_ORDER_STATUSES = new Set(['CONFIRMED', 'PREPARING', 'READY', 'SERVED'])
export const CHEF_ORDER_STATUSES = new Set(['PREPARING', 'READY'])

export function normalizeRole(role: string | undefined | null): AppRole {
  if (role === 'KITCHEN') return 'CHEF'
  if (role === 'CASHIER') return 'WAITER'
  if (role === 'OWNER' || role === 'MANAGER' || role === 'WAITER' || role === 'CHEF') {
    return role
  }
  return 'WAITER'
}

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  const normalized = normalizeRole(role)
  return ROLE_PERMISSIONS[normalized]?.has(permission) ?? false
}

export function hasAnyPermission(
  role: string | undefined | null,
  ...permissions: Permission[]
): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

export function getPermissionsForRole(role: string | undefined | null): Permission[] {
  const normalized = normalizeRole(role)
  return [...(ROLE_PERMISSIONS[normalized] ?? [])]
}

export function canSetOrderStatus(role: string | undefined | null, status: string): boolean {
  const normalized = normalizeRole(role)
  if (normalized === 'OWNER' || normalized === 'MANAGER') return true
  if (status === 'PAID') return hasPermission(normalized, 'orders.pay')
  if (status === 'CANCELLED') return hasPermission(normalized, 'orders.cancel')
  if (normalized === 'CHEF') return CHEF_ORDER_STATUSES.has(status)
  if (normalized === 'WAITER') return WAITER_ORDER_STATUSES.has(status)
  return false
}

export function canUpdateOrderItemStatus(role: string | undefined | null): boolean {
  return hasAnyPermission(role, 'orders.items', 'orders.kitchen_status')
}

export function assertPermission(
  role: string | undefined | null,
  permission: Permission,
): void {
  if (!hasPermission(role, permission)) {
    const err = new Error('FORBIDDEN')
    throw err
  }
}
