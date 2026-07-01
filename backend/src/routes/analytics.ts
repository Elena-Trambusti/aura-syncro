import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { calendarDateInTimezone, dayBoundsInTimezone, hourInTimezone, shiftCalendarDate } from '../lib/dates'
import { resolveRevenueAmount } from '../lib/fiscalAmounts'
import { buildDashboardSummary, loadTenantTimeRanges } from '../lib/analyticsSummary'
import { paidRevenueOrderWhere } from '../lib/analyticsFilters'
import { moneyNumber } from '../lib/money'

export const analyticsRouter = Router()

/** @deprecated Usare GET /summary — delega a buildDashboardSummary per evitare drift. */
analyticsRouter.get('/dashboard', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const summary = await buildDashboardSummary(req.restaurantId!)
  res.json(summary)
})

analyticsRouter.get('/revenue', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {  const { period = '7d' } = req.query
  const restaurantId = req.restaurantId!
  const ranges = await loadTenantTimeRanges(restaurantId)
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7

  const todayStr = calendarDateInTimezone(ranges.timeZone)
  const startDateStr = shiftCalendarDate(todayStr, -(days - 1))
  const { gte: startDate } = dayBoundsInTimezone(startDateStr, ranges.timeZone)
  const { lt: endDate } = dayBoundsInTimezone(shiftCalendarDate(todayStr, 1), ranges.timeZone)

  const orders = await prisma.order.findMany({
    where: paidRevenueOrderWhere(restaurantId, startDate, endDate),
    select: { revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true, paidAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const groupedByDay: Record<string, { revenue: number; orders: number }> = {}
  for (let i = 0; i < days; i++) {
    const key = shiftCalendarDate(startDateStr, i)
    groupedByDay[key] = { revenue: 0, orders: 0 }
  }

  orders.forEach(order => {
    const paidAt = order.paidAt ?? order.createdAt
    const key = calendarDateInTimezone(ranges.timeZone, paidAt)
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
  const ranges = await loadTenantTimeRanges(restaurantId)
  const thirtyDaysAgoStr = shiftCalendarDate(calendarDateInTimezone(ranges.timeZone), -30)
  const { gte: thirtyDaysAgo } = dayBoundsInTimezone(thirtyDaysAgoStr, ranges.timeZone)

  const items = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      status: { not: 'CANCELLED' },
      order: paidRevenueOrderWhere(restaurantId, thirtyDaysAgo, new Date()),
    },
    _sum: { quantity: true },
    _count: { id: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  })

  const menuItems = await prisma.menuItem.findMany({
    where: {
      restaurantId,
      id: { in: items.map((i: { menuItemId: string }) => i.menuItemId) },
    },
    select: { id: true, name: true, price: true, category: { select: { name: true } } },
  })

  const orderItems = await prisma.orderItem.findMany({
    where: {
      menuItemId: { in: items.map(i => i.menuItemId) },
      status: { not: 'CANCELLED' },
      order: paidRevenueOrderWhere(restaurantId, thirtyDaysAgo, new Date()),
    },
    select: { menuItemId: true, quantity: true, unitPrice: true },
  })

  const revenueByItem = new Map<string, number>()
  for (const oi of orderItems) {
    const gross = moneyNumber(oi.unitPrice) * oi.quantity
    revenueByItem.set(oi.menuItemId, (revenueByItem.get(oi.menuItemId) ?? 0) + gross)
  }

  const result = items.map((item) => {
    const menuItem = menuItems.find(m => m.id === item.menuItemId)
    return {
      menuItemId: item.menuItemId,
      name: menuItem?.name || '—',
      category: menuItem?.category.name || '',
      price: moneyNumber(menuItem?.price),
      quantity: item._sum.quantity || 0,
      revenue: Math.round((revenueByItem.get(item.menuItemId) ?? 0) * 100) / 100,
    }
  })

  res.json(result)
})

analyticsRouter.get('/hourly', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const ranges = await loadTenantTimeRanges(restaurantId)
  const sevenDaysAgoStr = shiftCalendarDate(calendarDateInTimezone(ranges.timeZone), -7)
  const { gte: sevenDaysAgo } = dayBoundsInTimezone(sevenDaysAgoStr, ranges.timeZone)

  const orders = await prisma.order.findMany({
    where: paidRevenueOrderWhere(restaurantId, sevenDaysAgo, new Date()),
    select: { createdAt: true, paidAt: true, revenueAmount: true, subtotal: true, tax: true, tipAmount: true, total: true },
  })

  const byHour: Record<number, { revenue: number; orders: number }> = {}
  for (let h = 0; h < 24; h++) byHour[h] = { revenue: 0, orders: 0 }

  orders.forEach(order => {
    const paidAt = order.paidAt ?? order.createdAt
    const hour = hourInTimezone(ranges.timeZone, paidAt)
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
