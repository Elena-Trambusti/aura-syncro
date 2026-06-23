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

export async function getTargetCustomers(restaurantId: string, filterJson: string | null) {
  let filter: CustomerFilter = {}
  try {
    if (filterJson) {
      const parsed = JSON.parse(filterJson) as CustomerFilter & { segment?: MarketingSegmentKey }
      if (parsed.segment && parsed.segment in MARKETING_SEGMENTS) {
        filter = { ...MARKETING_SEGMENTS[parsed.segment], ...parsed }
        delete (filter as { segment?: MarketingSegmentKey }).segment
      } else {
        filter = parsed
      }
    }
  } catch {
    /* filtro vuoto */
  }

  const where: Record<string, unknown> = { restaurantId, email: { not: null } }
  if (filter.minSpent) where.totalSpent = { gte: filter.minSpent }
  if (filter.minVisits) where.totalVisits = { gte: filter.minVisits }
  if (filter.tierId) where.loyaltyTierId = filter.tierId
  if (filter.inactiveDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter.inactiveDays)
    where.OR = [
      { lastVisit: { lte: cutoff } },
      { lastVisit: null, createdAt: { lte: cutoff } },
    ]
  }
  if (filter.newWithinDays) {
    const since = new Date()
    since.setDate(since.getDate() - filter.newWithinDays)
    where.createdAt = { gte: since }
  }
  if (filter.vipOnly) {
    where.OR = [
      { tags: { has: 'VIP' } },
      { totalSpent: { gte: 500 } },
      { totalVisits: { gte: 10 } },
    ]
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
