import { prisma } from './prisma'

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
