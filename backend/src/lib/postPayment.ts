import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { resolveRevenueAmount } from './fiscalAmounts'
import { earnLoyaltyPointsForOrder, updateCustomerTier } from './loyaltyHelpers'
import { moneyNumber } from './money'

type DbClient = Prisma.TransactionClient | typeof prisma

/** Aggiorna CRM e fedeltà dopo chiusura ordine PAID. Idempotente per stesso orderId. */
export async function applyPostPaymentEffects(orderId: string, restaurantId: string): Promise<void> {
  const orderFull = await prisma.order.findFirst({
    where: { id: orderId, restaurantId, status: 'PAID' },
    select: {
      id: true,
      customerId: true,
      revenueAmount: true,
      total: true,
      subtotal: true,
      tax: true,
      tipAmount: true,
      paidAt: true,
      refundedAt: true,
    },
  })
  if (!orderFull?.customerId) return
  if (orderFull.refundedAt) return

  const customerId = orderFull.customerId
  const order = orderFull

  const crmMarker = await prisma.loyaltyTransaction.findFirst({
    where: { orderId: order.id, restaurantId, type: 'ADJUSTMENT' },
    select: { id: true },
  })

  const earnedMarker = await prisma.loyaltyTransaction.findFirst({
    where: { orderId: order.id, type: 'EARNED' },
    select: { id: true },
  })

  const revenue = resolveRevenueAmount(order)
  const paidAt = order.paidAt ?? new Date()

  if (!crmMarker) {
    await prisma.customer.updateMany({
      where: { id: customerId, restaurantId },
      data: {
        totalVisits: { increment: 1 },
        totalSpent: { increment: revenue },
        lastVisit: paidAt,
      },
    })
    await prisma.loyaltyTransaction.create({
      data: {
        customerId,
        restaurantId,
        type: 'ADJUSTMENT',
        points: 0,
        orderId: order.id,
        description: `CRM visita ordine ${order.id.slice(-6)}`,
      },
    })
  } else if (!earnedMarker) {
    // Idempotenza: marker esiste ma earn non ancora eseguito (retry).
  }

  await earnLoyaltyPointsForOrder(customerId, restaurantId, revenue, order.id)
}

/** Storna CRM e fedeltà dopo rimborso ordine PAID. */
export async function reversePostPaymentEffects(
  orderId: string,
  restaurantId: string,
  db: DbClient = prisma,
): Promise<void> {
  const order = await db.order.findFirst({
    where: { id: orderId, restaurantId, status: 'PAID' },
    select: {
      id: true,
      customerId: true,
      revenueAmount: true,
      total: true,
      subtotal: true,
      tax: true,
      tipAmount: true,
    },
  })
  if (!order?.customerId) return

  const customerId = order.customerId
  const revenue = resolveRevenueAmount(order)

  const earned = await db.loyaltyTransaction.findFirst({
    where: { orderId, restaurantId, type: 'EARNED' },
    select: { id: true, points: true },
  })
  const crmMarker = await db.loyaltyTransaction.findFirst({
    where: { orderId, restaurantId, type: 'ADJUSTMENT' },
    select: { id: true },
  })

  const customer = await db.customer.findFirst({
    where: { id: customerId, restaurantId },
    select: { totalSpent: true, totalVisits: true, loyaltyPoints: true },
  })
  if (!customer) return

  const spentDecrement = Math.min(moneyNumber(customer.totalSpent), revenue)
  const visitsDecrement =
    crmMarker || spentDecrement > 0 ? Math.min(moneyNumber(customer.totalVisits), 1) : 0
  const pointsDecrement = earned ? Math.min(customer.loyaltyPoints, earned.points) : 0

  await db.customer.updateMany({
    where: { id: customerId, restaurantId },
    data: {
      totalSpent: { decrement: spentDecrement },
      ...(visitsDecrement > 0 ? { totalVisits: { decrement: visitsDecrement } } : {}),
      ...(pointsDecrement > 0 ? { loyaltyPoints: { decrement: pointsDecrement } } : {}),
    },
  })

  const lastPaid = await db.order.findFirst({
    where: {
      customerId,
      restaurantId,
      status: 'PAID',
      refundedAt: null,
    },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    select: { paidAt: true, createdAt: true },
  })
  await db.customer.updateMany({
    where: { id: customerId, restaurantId },
    data: {
      lastVisit: lastPaid ? (lastPaid.paidAt ?? lastPaid.createdAt) : null,
    },
  })

  if (earned && pointsDecrement > 0) {
    await db.loyaltyTransaction.create({
      data: {
        customerId,
        restaurantId,
        type: 'REDEEMED',
        points: -pointsDecrement,
        orderId,
        description: `Storno punti rimborso ordine ${orderId.slice(-6)}`,
      },
    })
    const updated = await db.customer.findFirst({
      where: { id: customerId, restaurantId },
      select: { loyaltyPoints: true },
    })
    if (updated) {
      await updateCustomerTier(restaurantId, customerId, updated.loyaltyPoints)
    }
  }

  if (crmMarker) {
    await db.loyaltyTransaction.deleteMany({
      where: { id: crmMarker.id, restaurantId },
    })
  }
}
