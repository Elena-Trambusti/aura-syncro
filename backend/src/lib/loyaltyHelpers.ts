import { prisma } from './prisma'

const DEFAULT_TIERS = [
  { name: 'Bronze', minPoints: 0, color: '#cd7f32', pointsPerEuro: 1, discountPct: 0, cashbackPct: 0, sortOrder: 0, benefits: '1 punto ogni € speso' },
  { name: 'Silver', minPoints: 200, color: '#94a3b8', pointsPerEuro: 1.2, discountPct: 5, cashbackPct: 0, sortOrder: 1, benefits: '1,2 pt/€ · 5% sconto' },
  { name: 'Gold', minPoints: 500, color: '#f59e0b', pointsPerEuro: 1.5, discountPct: 10, cashbackPct: 0, sortOrder: 2, benefits: '1,5 pt/€ · 10% sconto' },
] as const

/** Crea livelli fedeltà predefiniti se il ristorante non ne ha ancora */
export async function ensureDefaultLoyaltyTiers(restaurantId: string): Promise<boolean> {
  const count = await prisma.loyaltyTier.count({ where: { restaurantId } })
  if (count > 0) return false
  await prisma.loyaltyTier.createMany({
    data: DEFAULT_TIERS.map(t => ({ ...t, restaurantId })),
  })
  return true
}

/** Ricalcola il livello VIP di ogni cliente in base ai punti accumulati */
export async function syncAllCustomerTiers(restaurantId: string): Promise<number> {
  const customers = await prisma.customer.findMany({
    where: { restaurantId },
    select: { id: true, loyaltyPoints: true, loyaltyTierId: true },
  })
  let updated = 0
  for (const c of customers) {
    await updateCustomerTier(restaurantId, c.id, c.loyaltyPoints)
    if (!c.loyaltyTierId || c.loyaltyPoints > 0) {
      updated += 1
    }
  }
  return updated
}

/**
 * Bootstrap programma fedeltà automatico (Opzione A):
 * livelli default + iscrizione e tier sync per tutti i clienti esistenti.
 */
export async function bootstrapLoyaltyProgram(restaurantId: string): Promise<{ tiersCreated: boolean }> {
  const tiersCreated = await ensureDefaultLoyaltyTiers(restaurantId)

  const customers = await prisma.customer.findMany({
    where: { restaurantId },
    select: { id: true, loyaltyPoints: true },
  })

  for (const c of customers) {
    await ensureLoyaltyEnrollment(restaurantId, c.id)
    await updateCustomerTier(restaurantId, c.id, c.loyaltyPoints)
  }

  return { tiersCreated }
}

/** Assegna il livello entry al cliente se non ha ancora un tier */
export async function ensureLoyaltyEnrollment(restaurantId: string, customerId: string): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { loyaltyTierId: true, loyaltyPoints: true },
  })
  if (!customer || customer.loyaltyTierId) return

  const entryTier = await prisma.loyaltyTier.findFirst({
    where: { restaurantId },
    orderBy: { minPoints: 'asc' },
  })
  if (!entryTier) return

  await prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyTierId: entryTier.id },
  })
}

export async function updateCustomerTier(
  restaurantId: string,
  customerId: string,
  currentPoints: number,
): Promise<void> {
  const tiers = await prisma.loyaltyTier.findMany({
    where: { restaurantId },
    orderBy: { minPoints: 'desc' },
  })
  const newTier = tiers.find(t => currentPoints >= t.minPoints)
  await prisma.customer.updateMany({
    where: { id: customerId, restaurantId },
    data: { loyaltyTierId: newTier?.id ?? null },
  })
}

export async function earnLoyaltyPointsForOrder(
  customerId: string,
  restaurantId: string,
  revenueAmount: number,
  orderId: string,
): Promise<number> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, restaurantId },
    include: { loyaltyTier: true },
  })
  if (!customer) return 0

  const tier = customer.loyaltyTier
    ?? await prisma.loyaltyTier.findFirst({
      where: { restaurantId },
      orderBy: { minPoints: 'asc' },
    })

  if (!customer.loyaltyTierId && tier) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyTierId: tier.id },
    })
  }

  const pointsPerEuro = tier?.pointsPerEuro ?? 1
  const points = Math.floor(Math.max(0, revenueAmount) * pointsPerEuro)
  if (points <= 0) return 0

  const existing = await prisma.loyaltyTransaction.findFirst({
    where: { orderId, restaurantId, type: 'EARNED' },
  })
  if (existing) return customer.loyaltyPoints

  const updated = await prisma.$transaction(async tx => {
    await tx.loyaltyTransaction.create({
      data: {
        customerId,
        restaurantId,
        type: 'EARNED',
        points,
        orderId,
        description: `Punti da ordine ${orderId.slice(-6)}`,
      },
    })
    return tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: points } },
    })
  })

  await updateCustomerTier(restaurantId, customerId, updated.loyaltyPoints)
  return updated.loyaltyPoints
}
