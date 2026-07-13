/**
 * Prisma Client Extension — Barriera 1: Tenant Isolation a livello database.
 *
 * Ogni query su modelli con `restaurantId` viene automaticamente filtrata
 * sul tenant corrente. Il restaurantId proviene SEMPRE dalla sessione JWT
 * (middleware auth), mai dal body/query del client.
 *
 * Uso nelle route:
 *   const db = tenantPrisma(req)
 *   await db.order.findMany({ where: { status: 'OPEN' } })
 *   // → WHERE status = 'OPEN' AND restaurantId = '<tenant dalla sessione>'
 */
import { prisma } from './prisma'

/** Modelli con colonna diretta `restaurantId` — scope obbligatorio. */
export const TENANT_ROOT_MODELS = new Set<string>([
  'User',
  'Table',
  'MenuCategory',
  'MenuItem',
  'Order',
  'Reservation',
  'Customer',
  'Shift',
  'InventoryItem',
  'InventoryAdjustment',
  'LoyaltyTier',
  'LoyaltyTransaction',
  'Campaign',
  'MarketingAutomation',
  'MarketingAutomationSend',
  'WaitlistEntry',
  'Invoice',
  'FiscalSequence',
  'FiscalClosure',
  'CashRegisterSession',
  'ApiIdempotencyRecord',
  'FiscalChainState',
  'PushSubscription',
])

const READ_OPS = new Set([
  'findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy',
])
const WRITE_WHERE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany'])
const CREATE_OPS = new Set(['create', 'createMany'])

function mergeTenantWhere(
  restaurantId: string,
  where: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!where) return { restaurantId }
  return { ...where, restaurantId }
}

function assertTenantData(
  restaurantId: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (data.restaurantId != null && data.restaurantId !== restaurantId) {
    throw new Error('TENANT_MISMATCH: restaurantId nel payload non corrisponde al tenant della sessione')
  }
  return { ...data, restaurantId }
}

export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>

/** Factory: client Prisma con scope tenant forzato su ogni operazione. */
export function createTenantPrisma(restaurantId: string) {
  if (!restaurantId) {
    throw new Error('TENANT_REQUIRED: restaurantId mancante per createTenantPrisma')
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_ROOT_MODELS.has(model)) {
            return query(args)
          }

          const a = args as {
            where?: Record<string, unknown>
            data?: Record<string, unknown> | Record<string, unknown>[]
            create?: Record<string, unknown>
          }

          if (READ_OPS.has(operation) || WRITE_WHERE_OPS.has(operation)) {
            a.where = mergeTenantWhere(restaurantId, a.where)
          }

          if (operation === 'create' && a.data && !Array.isArray(a.data)) {
            a.data = assertTenantData(restaurantId, a.data)
          }

          if (operation === 'createMany' && Array.isArray(a.data)) {
            a.data = a.data.map(row => assertTenantData(restaurantId, row))
          }

          if (operation === 'upsert') {
            a.where = mergeTenantWhere(restaurantId, a.where)
            if (a.create) a.create = assertTenantData(restaurantId, a.create)
          }

          return query(args)
        },
      },
    },
  })
}

/** Cache per tenant — evita di ricreare l'extension ad ogni request nello stesso processo. */
const tenantClientCache = new Map<string, TenantPrismaClient>()

export function getTenantPrisma(restaurantId: string): TenantPrismaClient {
  let client = tenantClientCache.get(restaurantId)
  if (!client) {
    client = createTenantPrisma(restaurantId)
    tenantClientCache.set(restaurantId, client)
  }
  return client
}

/** Svuota cache tenant (utile in test). */
export function clearTenantPrismaCache(): void {
  tenantClientCache.clear()
}
