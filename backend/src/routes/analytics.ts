import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { calendarDateInTimezone, dayBoundsInTimezone, hourInTimezone, shiftCalendarDate } from '../lib/dates'
import { resolveRevenueAmount } from '../lib/fiscalAmounts'
import { buildDashboardSummary, loadTenantTimeRanges } from '../lib/analyticsSummary'
import { paidRevenueOrderWhere } from '../lib/analyticsFilters'
import { moneyNumber } from '../lib/money'
import { analyticsPeriodQuerySchema } from '../lib/reportQuerySchemas'
import { asyncHandler } from '../lib/asyncHandler'

export const analyticsRouter = Router()

/** @deprecated Usare GET /summary — delega a buildDashboardSummary per evitare drift. */
analyticsRouter.get('/dashboard', requirePermission('analytics.read'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const summary = await buildDashboardSummary(req.restaurantId!)
  res.json(summary)
}))

analyticsRouter.get('/revenue', requirePermission('analytics.read'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = analyticsPeriodQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Parametri non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = req.restaurantId!
  const ranges = await loadTenantTimeRanges(restaurantId)
  const days = parsed.data.period === '30d' ? 30 : parsed.data.period === '90d' ? 90 : 7

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
}))

analyticsRouter.get('/top-items', requirePermission('analytics.read'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const ranges = await loadTenantTimeRanges(restaurantId)
  const todayStr = calendarDateInTimezone(ranges.timeZone)
  const thirtyDaysAgoStr = shiftCalendarDate(todayStr, -30)
  const { gte: thirtyDaysAgo } = dayBoundsInTimezone(thirtyDaysAgoStr, ranges.timeZone)
  const { lt: periodEnd } = dayBoundsInTimezone(shiftCalendarDate(todayStr, 1), ranges.timeZone)
  const paidOrderWhere = paidRevenueOrderWhere(restaurantId, thirtyDaysAgo, periodEnd)

  const items = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      status: { not: 'CANCELLED' },
      order: paidOrderWhere,
    },
    _sum: { quantity: true },
    _count: { id: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  })

  const menuItemIds = items.map(i => i.menuItemId)
  if (menuItemIds.length === 0) {
    res.json([])
    return
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId, id: { in: menuItemIds } },
    select: { id: true, name: true, price: true, category: { select: { name: true } } },
  })

  const orderItems = await prisma.orderItem.findMany({
    where: {
      menuItemId: { in: menuItemIds },
      status: { not: 'CANCELLED' },
      order: paidOrderWhere,
    },
    select: {
      menuItemId: true,
      quantity: true,
      unitPrice: true,
      modifiers: { select: { price: true } },
    },
  })

  const revenueByItem = new Map<string, number>()
  for (const oi of orderItems) {
    const modifierTotal = oi.modifiers.reduce((sum, m) => sum + moneyNumber(m.price), 0)
    const gross = (moneyNumber(oi.unitPrice) + modifierTotal) * oi.quantity
    revenueByItem.set(oi.menuItemId, (revenueByItem.get(oi.menuItemId) ?? 0) + gross)
  }

  const result = items.map(item => {
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
}))

analyticsRouter.get('/hourly', requirePermission('analytics.read'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const ranges = await loadTenantTimeRanges(restaurantId)
  const todayStr = calendarDateInTimezone(ranges.timeZone)
  const sevenDaysAgoStr = shiftCalendarDate(todayStr, -7)
  const { gte: sevenDaysAgo } = dayBoundsInTimezone(sevenDaysAgoStr, ranges.timeZone)
  const { lt: periodEnd } = dayBoundsInTimezone(shiftCalendarDate(todayStr, 1), ranges.timeZone)

  const orders = await prisma.order.findMany({
    where: paidRevenueOrderWhere(restaurantId, sevenDaysAgo, periodEnd),
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
}))
