import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { startOfLocalDay } from '../lib/dates'
import { resolveRevenueAmount } from '../lib/fiscalAmounts'

function sumFoodFromAggregate(agg: { _sum: { revenueAmount?: number | null; subtotal?: number | null; tax?: number | null; tipAmount?: number | null; total?: number | null } }) {
  if (agg._sum.revenueAmount && agg._sum.revenueAmount > 0) return agg._sum.revenueAmount
  return (agg._sum.subtotal || 0) + (agg._sum.tax || 0)
}

export const analyticsRouter = Router()

/** PAID orders whose payment date (paidAt or createdAt fallback) falls in [start, end). */
function paidInRange(start: Date, end: Date) {
  return {
    status: 'PAID' as const,
    OR: [
      { paidAt: { gte: start, lt: end } },
      { paidAt: null, createdAt: { gte: start, lt: end } },
    ],
  }
}

analyticsRouter.get('/dashboard', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
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
    prisma.order.count({ where: { restaurantId, createdAt: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] } } }),
    prisma.order.aggregate({ where: { restaurantId, ...paidInRange(today, tomorrow) }, _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true } }),
    prisma.order.aggregate({ where: { restaurantId, ...paidInRange(thisMonthStart, tomorrow) }, _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true } }),
    prisma.order.aggregate({ where: { restaurantId, ...paidInRange(lastMonthStart, new Date(lastMonthEnd.getTime() + 1)) }, _sum: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true } }),
    prisma.customer.count({ where: { restaurantId } }),
    prisma.reservation.count({ where: { restaurantId, date: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } } }),
    prisma.order.count({ where: { restaurantId, status: { notIn: ['PAID', 'CANCELLED'] } } }),
    prisma.inventoryItem.count({ where: { restaurantId, quantity: { lte: prisma.inventoryItem.fields.minQuantity } } }),
  ])

  const monthFood = sumFoodFromAggregate(monthRevenue)
  const lastMonthFood = sumFoodFromAggregate(lastMonthRevenue)
  const revenueGrowth = lastMonthFood
    ? ((monthFood - lastMonthFood) / lastMonthFood) * 100
    : 0

  res.json({
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
  })
})

analyticsRouter.get('/revenue', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { period = '7d' } = req.query
  const restaurantId = req.restaurantId!

  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: 'PAID',
      createdAt: { gte: startDate },
    },
    select: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const groupedByDay: Record<string, { revenue: number; orders: number }> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().split('T')[0]
    groupedByDay[key] = { revenue: 0, orders: 0 }
  }

  orders.forEach(order => {
    const key = order.createdAt.toISOString().split('T')[0]
    if (groupedByDay[key]) {
      groupedByDay[key].revenue += resolveRevenueAmount(order)
      groupedByDay[key].orders += 1
    }
  })

  const data = Object.entries(groupedByDay).map(([date, values]) => ({
    date,
    revenue: Math.round(values.revenue * 100) / 100,
    orders: values.orders,
  }))

  res.json(data)
})

analyticsRouter.get('/top-items', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const items = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: { order: { restaurantId, status: 'PAID', createdAt: { gte: thirtyDaysAgo } } },
    _sum: { quantity: true },
    _count: { id: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  })

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i: { menuItemId: string }) => i.menuItemId) } },
    select: { id: true, name: true, price: true, category: { select: { name: true } } },
  })

  const result = items.map((item: { menuItemId: string; _sum: { quantity: number | null } }) => {
    const menuItem = menuItems.find((m: { id: string; name: string; price: number; category: { name: string } }) => m.id === item.menuItemId)
    return {
      menuItemId: item.menuItemId,
      name: menuItem?.name || 'Sconosciuto',
      category: menuItem?.category.name || '',
      price: menuItem?.price || 0,
      quantity: item._sum.quantity || 0,
      revenue: (menuItem?.price || 0) * (item._sum.quantity || 0),
    }
  })

  res.json(result)
})

analyticsRouter.get('/hourly', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const orders = await prisma.order.findMany({
    where: { restaurantId, status: 'PAID', createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
  })

  const byHour: Record<number, { revenue: number; orders: number }> = {}
  for (let h = 0; h < 24; h++) byHour[h] = { revenue: 0, orders: 0 }

  orders.forEach(order => {
    const hour = order.createdAt.getHours()
    byHour[hour].revenue += resolveRevenueAmount(order)
    byHour[hour].orders += 1
  })

  const data = Object.entries(byHour).map(([hour, values]) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    revenue: Math.round(values.revenue * 100) / 100,
    orders: values.orders,
  }))

  res.json(data)
})
