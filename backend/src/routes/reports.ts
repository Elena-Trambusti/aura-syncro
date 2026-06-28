import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest, requireRole } from '../middleware/auth'
import { requireProPlan } from '../middleware/planTier'
import { requirePermission } from '../middleware/permissions'
import {
  buildDateRange,
  buildMonthRange,
  effectivePaidAt,
  legacyPaidOrdersWhere,
  paidOrdersWhere,
} from '../lib/dates'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { getFiscalStrategyFromConfig } from '../lib/fiscal/strategies'
import { buildFiscalSummary, buildFiscalTransactionRow } from '../lib/tipFiscal'
import { verifyFiscalChainSequence } from '../lib/fiscal/fiscalIntegrityChain'

export const reportsRouter = Router()

const fiscalOrderSelect = {
  id: true,
  paidAt: true,
  createdAt: true,
  subtotal: true,
  tax: true,
  taxRateApplied: true,
  revenueAmount: true,
  tipAmount: true,
  total: true,
  paymentMethod: true,
  fiscalIntegrityHash: true,
  fiscalPrevHash: true,
  fiscalClosedAt: true,
  invoice: { select: { documentNumber: true } },
} as const

async function fetchPaidOrdersInPeriod(restaurantId: string, start: Date, end: Date) {
  const [primary, legacy] = await Promise.all([
    prisma.order.findMany({
      where: paidOrdersWhere(restaurantId, start, end),
      select: fiscalOrderSelect,
      orderBy: { paidAt: 'asc' },
    }),
    prisma.order.findMany({
      where: legacyPaidOrdersWhere(restaurantId, start, end),
      select: fiscalOrderSelect,
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const byId = new Map<string, (typeof primary)[number]>()
  for (const order of [...primary, ...legacy]) {
    byId.set(order.id, order)
  }

  return [...byId.values()].sort((a, b) => {
    const da = effectivePaidAt(a.paidAt, a.createdAt).getTime()
    const db = effectivePaidAt(b.paidAt, b.createdAt).getTime()
    return da - db
  })
}

// ── P&L Mensile ───────────────────────────────────────────────────────────────

reportsRouter.get('/pl', requirePermission('reports.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query
  const restaurantId = req.restaurantId!

  const y = Number(year)
  const m = Number(month)
  const { start: startDate, end: endDate } = buildMonthRange(y, m)
  const orderWhere = paidOrdersWhere(restaurantId, startDate, endDate)

  // Ricavi da ordini pagati
  const revenueData = await prisma.order.aggregate({
    where: orderWhere,
    _sum: { revenueAmount: true, tipAmount: true, total: true, subtotal: true, tax: true, discount: true },
    _count: true,
  })

  // Food cost stimato da inventory links
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: orderWhere,
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

  const revenue = revenueData._sum.revenueAmount || revenueData._sum.subtotal! + (revenueData._sum.tax || 0) || 0
  const tips = revenueData._sum.tipAmount || 0
  const collected = revenueData._sum.total || 0
  const grossProfit = revenue - estimatedFoodCost
  const netProfit = grossProfit - laborCost
  const foodCostPct = revenue > 0 ? (estimatedFoodCost / revenue) * 100 : 0
  const laborCostPct = revenue > 0 ? (laborCost / revenue) * 100 : 0

  // Breakdown giornaliero
  const dailyOrders = await prisma.order.findMany({
    where: orderWhere,
    select: { revenueAmount: true, tipAmount: true, total: true, paidAt: true, discount: true, subtotal: true, tax: true },
    orderBy: { paidAt: 'asc' },
  })

  const dailyMap: Record<string, { revenue: number; tips: number; collected: number; orders: number; discount: number }> = {}
  for (const o of dailyOrders) {
    if (!o.paidAt) continue
    const key = o.paidAt.toISOString().split('T')[0]
    if (!dailyMap[key]) dailyMap[key] = { revenue: 0, tips: 0, collected: 0, orders: 0, discount: 0 }
    const food = o.revenueAmount ?? (o.subtotal + o.tax)
    dailyMap[key].revenue += food
    dailyMap[key].tips += o.tipAmount ?? 0
    dailyMap[key].collected += o.total
    dailyMap[key].orders += 1
    dailyMap[key].discount += o.discount
  }

  const dailyBreakdown = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

  res.json({
    period: { year: y, month: m, startDate, endDate },
    summary: {
      revenue: Math.round(revenue * 100) / 100,
      tips: Math.round(tips * 100) / 100,
      collected: Math.round(collected * 100) / 100,
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

reportsRouter.get('/food-cost', requirePermission('reports.read'), async (req: AuthRequest, res: Response): Promise<void> => {
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

reportsRouter.get('/categories', requirePermission('reports.read'), async (req: AuthRequest, res: Response): Promise<void> => {
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

reportsRouter.get('/yearly', requirePermission('reports.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { year = new Date().getFullYear() } = req.query
  const restaurantId = req.restaurantId!
  const y = Number(year)

  const months = []
  for (let m = 1; m <= 12; m++) {
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59)

    const agg = await prisma.order.aggregate({
      where: { restaurantId, status: 'PAID', paidAt: { gte: start, lte: end } },
      _sum: { revenueAmount: true, tipAmount: true, total: true, subtotal: true, tax: true },
      _count: true,
    })

    const foodRevenue = agg._sum.revenueAmount ?? ((agg._sum.subtotal || 0) + (agg._sum.tax || 0))

    months.push({
      month: m,
      monthName: new Date(y, m - 1).toLocaleString('it-IT', { month: 'short' }),
      revenue: Math.round(foodRevenue * 100) / 100,
      tips: Math.round((agg._sum.tipAmount || 0) * 100) / 100,
      collected: Math.round((agg._sum.total || 0) * 100) / 100,
      orders: agg._count,
    })
  }

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0)
  const bestMonth = months.reduce((best, m) => m.revenue > best.revenue ? m : best, months[0])

  res.json({ year: y, months, totalRevenue: Math.round(totalRevenue * 100) / 100, bestMonth })
})

// ── Report fiscal (multi-nazione: IVA / IGIC) ─────────────────────────────────

reportsRouter.get('/fiscal', requireRole('OWNER', 'MANAGER'), requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const mode = (req.query.mode as string) || 'month'

  const range = buildDateRange(req.query as Record<string, string | undefined>)
  if (!range) {
    res.status(400).json({ error: 'Filtro date non valido' })
    return
  }

  const [restaurant, orders] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { settings: true },
    }),
    fetchPaidOrdersInPeriod(restaurantId, range.start, range.end),
  ])

  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  const fiscal = buildFiscalConfig(restaurant.settings)
  const strategy = getFiscalStrategyFromConfig(fiscal)

  const rows = orders.map(o => {
    const row = buildFiscalTransactionRow(o, effectivePaidAt(o.paidAt, o.createdAt))
    return {
      fecha: row.fecha,
      orderId: row.orderId,
      baseImponible: row.baseImponible,
      tax: row.tax,
      taxRateApplied: row.taxRateApplied,
      revenueAmount: row.revenueAmount,
      tipAmount: row.tipAmount,
      total: row.total,
      paymentMethod: row.paymentMethod,
      documentNumber: o.invoice?.documentNumber ?? null,
      fiscalIntegrityHash: row.fiscalIntegrityHash ?? null,
      fiscalPrevHash: row.fiscalPrevHash ?? null,
    }
  })

  const chainAudit = verifyFiscalChainSequence(
    orders.map(o => ({
      id: o.id,
      fiscalClosedAt: o.fiscalClosedAt,
      total: o.total,
      fiscalPrevHash: o.fiscalPrevHash,
      fiscalIntegrityHash: o.fiscalIntegrityHash,
      paidAt: o.paidAt,
    })),
  )

  const summary = buildFiscalSummary(rows, fiscal.taxRegion)
  const reportProfile = strategy.getComplianceProfile(fiscal)
  const reportLabels = strategy.getReportLabels(fiscal.taxRate)
  const pdfOptions = strategy.getPdfExportOptions()

  res.json({
    fiscalRegime: fiscalConfigPayload(fiscal, restaurant.settings?.taxId),
    reportProfile,
    reportLabels,
    pdfOptions,
    compliance: {
      fiscalRegion: fiscal.fiscalRegion,
      operativeRegime: reportProfile.operativeRegime,
      integrityChainValid: chainAudit.valid,
      brokenAtOrderId: chainAudit.brokenAtOrderId ?? null,
      verifactuEnabled: reportProfile.verifactuEnabled,
    },
    restaurant: {
      name: restaurant.name,
      address: restaurant.address,
      email: restaurant.email,
      taxId: restaurant.settings?.taxId || null,
    },
    period: { mode, start: range.start.toISOString(), end: range.end.toISOString() },
    rows,
    summary: {
      totalFacturadoNeto: summary.totalFacturadoNeto,
      totalPropinas: summary.totalPropinas,
      totalConciliacion: summary.totalConciliacion,
      transactionCount: summary.transactionCount,
      tipTaxStatus: summary.tipTaxStatus,
      ...(summary.electronicTipsTotal != null
        ? { electronicTipsTotal: summary.electronicTipsTotal }
        : {}),
      ...(summary.tipsDistribution ? { tipsDistribution: summary.tipsDistribution } : {}),
    },
  })
})

// ── Chiusura Fiscale Zeta (Aruba FE) ──────────────────────────────────────────

reportsRouter.post('/zeta', requireRole('OWNER', 'MANAGER'), requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  // 1. Controlla se c'è già una chiusura oggi
  const existing = await prisma.fiscalClosure.findFirst({
    where: { restaurantId, date: { gte: startOfDay, lte: endOfDay } }
  })

  if (existing) {
    res.status(409).json({ error: 'Chiusura fiscale già effettuata per oggi.' })
    return
  }

  // 2. Calcola i totali del giorno
  const orders = await fetchPaidOrdersInPeriod(restaurantId, startOfDay, endOfDay)
  
  if (orders.length === 0) {
    res.status(400).json({ error: 'Nessun ordine pagato oggi. Chiusura non necessaria.' })
    return
  }

  let totalRevenue = 0
  let totalTax = 0
  let totalCash = 0
  let totalCard = 0
  let totalTip = 0

  for (const o of orders) {
    totalRevenue += o.revenueAmount ?? (o.subtotal + o.tax)
    totalTax += o.tax
    totalTip += o.tipAmount ?? 0
    if (o.paymentMethod === 'CASH') totalCash += o.total
    else if (o.paymentMethod) totalCard += o.total
  }

  // 3. Genera il record di Chiusura
  const closure = await prisma.fiscalClosure.create({
    data: {
      restaurantId,
      date: new Date(),
      totalRevenue,
      totalTax,
      totalCash,
      totalCard,
      totalTip,
      orderCount: orders.length,
      status: 'GENERATED',
    }
  })

  // TODO: Integrati qui con Aruba FE per inviare il tracciato XML dei corrispettivi giornalieri
  // se ARUBA_FE_ENABLED=true nel file .env

  res.json(closure)
})
