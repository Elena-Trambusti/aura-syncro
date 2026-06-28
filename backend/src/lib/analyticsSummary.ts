import { prisma } from './prisma'
import { startOfLocalDay } from './dates'
import { kitchenActiveOrdersWhere } from './orderSession'

function sumFoodFromAggregate(agg: {
  _sum: {
    revenueAmount?: number | null
    subtotal?: number | null
    tax?: number | null
    tipAmount?: number | null
    total?: number | null
  }
}) {
  if (agg._sum.revenueAmount && agg._sum.revenueAmount > 0) return agg._sum.revenueAmount
  return (agg._sum.subtotal || 0) + (agg._sum.tax || 0)
}

function paidInRange(start: Date, end: Date) {
  return {
    status: 'PAID' as const,
    OR: [
      { paidAt: { gte: start, lt: end } },
      { paidAt: null, createdAt: { gte: start, lt: end } },
    ],
  }
}

/** KPI dashboard — disponibile anche piano Base (senza Pro). */
export async function buildDashboardSummary(restaurantId: string) {
  const today = startOfLocalDay()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)

  const [
    todayOrders,
    todayRevenue,
    monthRevenue,
    lastMonthRevenue,
    totalCustomers,
    todayReservations,
    activeOrders,
    lowStockItems,
  ] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, createdAt: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] } },
    }),
    prisma.order.aggregate({
      where: { restaurantId, ...paidInRange(today, tomorrow) },
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
    }),
    prisma.order.aggregate({
      where: { restaurantId, ...paidInRange(thisMonthStart, tomorrow) },
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
    }),
    prisma.order.aggregate({
      where: { restaurantId, ...paidInRange(lastMonthStart, new Date(lastMonthEnd.getTime() + 1)) },
      _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
    }),
    prisma.customer.count({ where: { restaurantId } }),
    prisma.reservation.count({
      where: { restaurantId, date: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    }),
    prisma.order.count({ where: kitchenActiveOrdersWhere(restaurantId) }),
    prisma.inventoryItem.count({
      where: { restaurantId, quantity: { lte: prisma.inventoryItem.fields.minQuantity } },
    }),
  ])

  const monthFood = sumFoodFromAggregate(monthRevenue)
  const lastMonthFood = sumFoodFromAggregate(lastMonthRevenue)
  const revenueGrowth = lastMonthFood ? ((monthFood - lastMonthFood) / lastMonthFood) * 100 : 0

  return {
    today: {
      orders: todayOrders,
      revenue: sumFoodFromAggregate(todayRevenue),
      tips: todayRevenue._sum.tipAmount || 0,
      collected: todayRevenue._sum.total || 0,
      reservations: todayReservations,
      activeOrders,
    },
    month: {
      revenue: monthFood,
      tips: monthRevenue._sum.tipAmount || 0,
      collected: monthRevenue._sum.total || 0,
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    },
    totals: { customers: totalCustomers, lowStockAlerts: lowStockItems },
  }
}
