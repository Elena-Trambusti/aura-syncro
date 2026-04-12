import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const reportsRouter = Router()

// ── P&L Mensile ───────────────────────────────────────────────────────────────

reportsRouter.get('/pl', async (req: AuthRequest, res: Response): Promise<void> => {
  const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query
  const restaurantId = req.restaurantId!

  const y = Number(year)
  const m = Number(month)
  const startDate = new Date(y, m - 1, 1)
  const endDate = new Date(y, m, 0, 23, 59, 59)

  // Ricavi da ordini pagati
  const revenueData = await prisma.order.aggregate({
    where: { restaurantId, status: 'PAID', paidAt: { gte: startDate, lte: endDate } },
    _sum: { total: true, subtotal: true, tax: true, discount: true },
    _count: true,
  })

  // Food cost stimato da inventory links
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: { restaurantId, status: 'PAID', paidAt: { gte: startDate, lte: endDate } },
    },
    include: {
      menuItem: {
        include: { inventoryLinks: { include: { inventoryItem: true } } },
      },
    },
  })

  let estimatedFoodCost = 0
  for (const item of orderItems) {
    for (const link of item.menuItem.inventoryLinks) {
      estimatedFoodCost += link.quantity * link.inventoryItem.cost * item.quantity
    }
  }

  // Costo personale stimato (ore lavorate × tariffa media)
  const shifts = await prisma.shift.findMany({
    where: {
      restaurantId,
      status: 'COMPLETED',
      date: { gte: startDate, lte: endDate },
    },
  })

  const HOURLY_RATE = 12 // €/ora stimato
  let laborCost = 0
  for (const s of shifts) {
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    const hours = (eh * 60 + em - (sh * 60 + sm)) / 60
    laborCost += Math.max(0, hours) * HOURLY_RATE
  }

  const revenue = revenueData._sum.total || 0
  const grossProfit = revenue - estimatedFoodCost
  const netProfit = grossProfit - laborCost
  const foodCostPct = revenue > 0 ? (estimatedFoodCost / revenue) * 100 : 0
  const laborCostPct = revenue > 0 ? (laborCost / revenue) * 100 : 0

  // Breakdown giornaliero
  const dailyOrders = await prisma.order.findMany({
    where: { restaurantId, status: 'PAID', paidAt: { gte: startDate, lte: endDate } },
    select: { total: true, paidAt: true, discount: true },
    orderBy: { paidAt: 'asc' },
  })

  const dailyMap: Record<string, { revenue: number; orders: number; discount: number }> = {}
  for (const o of dailyOrders) {
    if (!o.paidAt) continue
    const key = o.paidAt.toISOString().split('T')[0]
    if (!dailyMap[key]) dailyMap[key] = { revenue: 0, orders: 0, discount: 0 }
    dailyMap[key].revenue += o.total
    dailyMap[key].orders += 1
    dailyMap[key].discount += o.discount
  }

  const dailyBreakdown = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

  res.json({
    period: { year: y, month: m, startDate, endDate },
    summary: {
      revenue: Math.round(revenue * 100) / 100,
      subtotal: Math.round((revenueData._sum.subtotal || 0) * 100) / 100,
      tax: Math.round((revenueData._sum.tax || 0) * 100) / 100,
      totalDiscount: Math.round((revenueData._sum.discount || 0) * 100) / 100,
      orders: revenueData._count,
      estimatedFoodCost: Math.round(estimatedFoodCost * 100) / 100,
      laborCost: Math.round(laborCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      foodCostPct: Math.round(foodCostPct * 10) / 10,
      laborCostPct: Math.round(laborCostPct * 10) / 10,
    },
    dailyBreakdown,
  })
})

// ── Food Cost per Piatto ───────────────────────────────────────────────────────

reportsRouter.get('/food-cost', async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId },
    include: {
      category: { select: { name: true } },
      inventoryLinks: { include: { inventoryItem: { select: { name: true, unit: true, cost: true } } } },
    },
  })

  // Vendite ultimi 30 giorni
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const salesData = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: { order: { restaurantId, status: 'PAID', createdAt: { gte: thirtyDaysAgo } } },
    _sum: { quantity: true },
  })

  const salesMap = new Map(salesData.map(s => [s.menuItemId, s._sum.quantity || 0]))

  const items = menuItems.map(item => {
    const ingredientCost = item.inventoryLinks.reduce((sum, link) => sum + link.quantity * link.inventoryItem.cost, 0)
    const margin = item.price - ingredientCost
    const marginPct = item.price > 0 ? (margin / item.price) * 100 : 0
    const soldQty = salesMap.get(item.id) || 0
    const totalRevenue = item.price * soldQty
    const totalCost = ingredientCost * soldQty

    return {
      id: item.id,
      name: item.name,
      category: item.category.name,
      price: item.price,
      ingredientCost: Math.round(ingredientCost * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
      soldQty,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      ingredients: item.inventoryLinks.map(l => ({
        name: l.inventoryItem.name,
        unit: l.inventoryItem.unit,
        qty: l.quantity,
        cost: l.inventoryItem.cost,
      })),
    }
  })

  items.sort((a, b) => b.marginPct - a.marginPct)

  res.json(items)
})

// ── Analisi per categoria ──────────────────────────────────────────────────────

reportsRouter.get('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  const { days = 30 } = req.query
  const restaurantId = req.restaurantId!
  const since = new Date()
  since.setDate(since.getDate() - Number(days))

  const data = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: { order: { restaurantId, status: 'PAID', createdAt: { gte: since } } },
    _sum: { quantity: true },
    _count: { id: true },
  })

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: data.map((d: { menuItemId: string }) => d.menuItemId) } },
    include: { category: true },
  })

  const categoryMap: Record<string, { name: string; revenue: number; qty: number }> = {}
  for (const item of data) {
    const mi = menuItems.find((m: { id: string }) => m.id === item.menuItemId)
    if (!mi) continue
    const catName = mi.category.name
    if (!categoryMap[catName]) categoryMap[catName] = { name: catName, revenue: 0, qty: 0 }
    categoryMap[catName].qty += item._sum.quantity || 0
    categoryMap[catName].revenue += mi.price * (item._sum.quantity || 0)
  }

  const result = Object.values(categoryMap)
    .map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)

  res.json(result)
})

// ── Trend mensili annuali ──────────────────────────────────────────────────────

reportsRouter.get('/yearly', async (req: AuthRequest, res: Response): Promise<void> => {
  const { year = new Date().getFullYear() } = req.query
  const restaurantId = req.restaurantId!
  const y = Number(year)

  const months = []
  for (let m = 1; m <= 12; m++) {
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59)

    const agg = await prisma.order.aggregate({
      where: { restaurantId, status: 'PAID', paidAt: { gte: start, lte: end } },
      _sum: { total: true },
      _count: true,
    })

    months.push({
      month: m,
      monthName: new Date(y, m - 1).toLocaleString('it-IT', { month: 'short' }),
      revenue: Math.round((agg._sum.total || 0) * 100) / 100,
      orders: agg._count,
    })
  }

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0)
  const bestMonth = months.reduce((best, m) => m.revenue > best.revenue ? m : best, months[0])

  res.json({ year: y, months, totalRevenue: Math.round(totalRevenue * 100) / 100, bestMonth })
})
