import { z } from 'zod'
import { prisma } from './prisma'

export type CustomerFilter = {
  minSpent?: number
  minVisits?: number
  tierId?: string
  inactiveDays?: number
  /** Clienti registrati negli ultimi N giorni */
  newWithinDays?: number
  /** Solo clienti con tag VIP */
  vipOnly?: boolean
  /** Compleanno nel prossimo mese (campagna manuale) */
  birthdayMonth?: boolean
}

/** Segmenti predefiniti per campagne marketing */
export const MARKETING_SEGMENTS = {
  all: {},
  inactive60: { inactiveDays: 60 },
  inactive90: { inactiveDays: 90 },
  topSpender: { minSpent: 500 },
  frequent: { minVisits: 10 },
  newCustomers: { newWithinDays: 30 },
  vip: { vipOnly: true },
} as const satisfies Record<string, CustomerFilter>

export type MarketingSegmentKey = keyof typeof MARKETING_SEGMENTS

const marketingSegmentKeys = Object.keys(MARKETING_SEGMENTS) as [
  MarketingSegmentKey,
  ...MarketingSegmentKey[],
]

export const customerFilterSchema = z.object({
  minSpent: z.number().min(0).optional(),
  minVisits: z.number().int().min(0).optional(),
  tierId: z.string().min(1).max(64).optional(),
  inactiveDays: z.number().int().min(1).max(3650).optional(),
  newWithinDays: z.number().int().min(1).max(3650).optional(),
  vipOnly: z.boolean().optional(),
  birthdayMonth: z.boolean().optional(),
  segment: z.enum(marketingSegmentKeys).optional(),
}).strict()

export const marketingTargetFilterSchema = z.union([
  z.literal(''),
  z.string().max(1000),
  z.null(),
  z.undefined(),
])

/** Valida e normalizza il filtro destinatari marketing (JSON string o vuoto). */
export function parseCustomerFilter(filterJson: string | null | undefined): CustomerFilter {
  if (!filterJson?.trim()) return {}

  try {
    const raw = JSON.parse(filterJson)
    const parsed = customerFilterSchema.safeParse(raw)
    if (!parsed.success) return {}

    const { segment, ...rest } = parsed.data
    if (segment && segment in MARKETING_SEGMENTS) {
      const merged = { ...MARKETING_SEGMENTS[segment], ...rest }
      return merged
    }
    return rest
  } catch {
    return {}
  }
}

export async function getTargetCustomers(restaurantId: string, filterJson: string | null) {
  const filter = parseCustomerFilter(filterJson)

  const where: Record<string, unknown> = { restaurantId, email: { contains: '@' } }
  const andConditions: any[] = []

  if (filter.minSpent) where.totalSpent = { gte: filter.minSpent }
  if (filter.minVisits) where.totalVisits = { gte: filter.minVisits }
  if (filter.tierId) where.loyaltyTierId = filter.tierId

  if (filter.inactiveDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter.inactiveDays)
    andConditions.push({
      OR: [
        { lastVisit: { lte: cutoff } },
        { lastVisit: null, createdAt: { lte: cutoff } },
      ],
    })
  }

  if (filter.newWithinDays) {
    const since = new Date()
    since.setDate(since.getDate() - filter.newWithinDays)
    where.createdAt = { gte: since }
  }

  if (filter.vipOnly) {
    andConditions.push({
      OR: [
        { tags: { has: 'VIP' } },
        { totalSpent: { gte: 500 } },
        { totalVisits: { gte: 10 } },
      ],
    })
  }

  if (andConditions.length > 0) {
    where.AND = andConditions
  }
  if (filter.birthdayMonth) {
    const now = new Date()
    const month = now.getMonth()
    where.birthdate = { not: null }
    // Filtraggio mese lato applicazione (Prisma non supporta extract month su tutti i DB)
    const all = await prisma.customer.findMany({
      where,
      select: { id: true, name: true, email: true, phone: true, birthdate: true },
    })
    return all.filter(c => c.birthdate && new Date(c.birthdate).getMonth() === month)
  }

  return prisma.customer.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true },
  })
}
