/**
 * Mirror di backend/src/lib/permissions.ts — mantenere allineato.
 */
export type AppRole = 'OWNER' | 'MANAGER' | 'WAITER' | 'CHEF' | 'BARTENDER' | 'HOST'

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

const MANAGER_PERMISSIONS = new Set<Permission>([
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
  'reports.read',
  'customers.read',
  'customers.manage',
  'analytics.read',
])

const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  OWNER: ALL_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
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
  BARTENDER: new Set<Permission>([
    'orders.read',
    'orders.create',
    'orders.items',
    'orders.status',
    'menu.read',
    'menu.availability',
    'inventory.read',
  ]),
  HOST: new Set<Permission>([
    'tables.read',
    'tables.status',
    'reservations.read',
    'reservations.manage',
    'orders.read',
    'customers.read',
  ]),
}

export const WAITER_ORDER_STATUSES = new Set(['CONFIRMED', 'PREPARING', 'READY', 'SERVED'])
export const CHEF_ORDER_STATUSES = new Set(['PREPARING', 'READY', 'SERVED'])

const KNOWN_ROLES = new Set<string>(['OWNER', 'MANAGER', 'WAITER', 'CHEF', 'BARTENDER', 'HOST'])

export function isKnownRole(role: string | undefined | null): role is AppRole {
  if (!role) return false
  const r = role === 'KITCHEN' ? 'CHEF' : role === 'CASHIER' ? 'WAITER' : role
  return KNOWN_ROLES.has(r)
}

export function normalizeRole(role: string | undefined | null): AppRole {
  if (role === 'KITCHEN') return 'CHEF'
  if (role === 'CASHIER') return 'WAITER'
  if (isKnownRole(role)) return role
  return 'WAITER'
}

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  if (!isKnownRole(role)) return false
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

export function hasAnyPermission(
  role: string | undefined | null,
  ...permissions: Permission[]
): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

export function getPermissionsForRole(role: string | undefined | null): Permission[] {
  if (!isKnownRole(role)) return []
  return [...(ROLE_PERMISSIONS[role] ?? [])]
}

export function canSetOrderStatus(role: string | undefined | null, status: string): boolean {
  const normalized = normalizeRole(role)
  if (normalized === 'OWNER' || normalized === 'MANAGER') return true
  if (status === 'PAID') return hasPermission(normalized, 'orders.pay')
  if (status === 'CANCELLED') return hasPermission(normalized, 'orders.cancel')
  if (normalized === 'CHEF') return CHEF_ORDER_STATUSES.has(status)
  if (normalized === 'WAITER' || normalized === 'BARTENDER') return WAITER_ORDER_STATUSES.has(status)
  return false
}

export function canUpdateOrderItemStatus(role: string | undefined | null): boolean {
  return hasAnyPermission(role, 'orders.items', 'orders.kitchen_status')
}
