import { prisma } from './prisma'

export type CustomerFilter = {
  minSpent?: number
  minVisits?: number
  tierId?: string
  inactiveDays?: number
}

export async function getTargetCustomers(restaurantId: string, filterJson: string | null) {
  let filter: CustomerFilter = {}
  try {
    if (filterJson) filter = JSON.parse(filterJson) as CustomerFilter
  } catch {
    /* filtro vuoto */
  }

  const where: Record<string, unknown> = { restaurantId }
  if (filter.minSpent) where.totalSpent = { gte: filter.minSpent }
  if (filter.minVisits) where.totalVisits = { gte: filter.minVisits }
  if (filter.tierId) where.loyaltyTierId = filter.tierId
  if (filter.inactiveDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter.inactiveDays)
    where.lastVisit = { lte: cutoff }
  }

  return prisma.customer.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true },
  })
}
