import { Router, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AuthRequest, requireRole } from '../middleware/auth'
import { requireProPlan } from '../middleware/planTier'
import { requirePermission } from '../middleware/permissions'
import {
  buildDateRange,
  buildDateRangeForTimezone,
  buildMonthRange,
  buildMonthRangeInTimezone,
  calendarDateInTimezone,
  dayBoundsInTimezone,
  dayRangeInTimezone,
  effectivePaidAt,
  endOfLocalDay,
  startOfLocalDay,
  paidOrdersInPeriodWhere,
} from '../lib/dates'
import { FISCAL_REGION_GENESIS } from '../lib/fiscal/fiscalRegion'
import { buildFiscalConfig, fiscalConfigPayload } from '../lib/taxEngine'
import { getFiscalStrategyFromConfig } from '../lib/fiscal/strategies'
import { buildFiscalSummary, buildFiscalTransactionRow } from '../lib/tipFiscal'
import { verifyFiscalChainSequence } from '../lib/fiscal/fiscalIntegrityChain'
import { moneyNumber, sumFoodFromMoneyAgg, toMoney } from '../lib/money'
import { isFiscalRangeWithinLimit, MAX_FISCAL_RANGE_DAYS } from '../lib/fiscalReportLimits'
import {
  reportDaysQuerySchema,
  reportYearMonthQuerySchema,
  reportYearQuerySchema,
} from '../lib/reportQuerySchemas'
import { asyncHandler } from '../lib/asyncHandler'

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
  discount: true,
  paymentMethod: true,
  fiscalIntegrityHash: true,
  fiscalPrevHash: true,
  fiscalClosedAt: true,
  fiscalRegionSnapshot: true,
  invoice: { select: { documentNumber: true } },
} as const

async function fetchPaidOrdersInPeriod(restaurantId: string, start: Date, end: Date) {
  return prisma.order.findMany({
    where: paidOrdersInPeriodWhere(restaurantId, start, end, false, true),
    select: fiscalOrderSelect,
    orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
  })
}

async function resolveChainInitialPrevHash(
  restaurantId: string,
  rangeStart: Date,
): Promise<string> {
  const prev = await prisma.order.findFirst({
    where: {
      restaurantId,
      status: 'PAID',
      fiscalIntegrityHash: { not: null },
      OR: [
        { paidAt: { lt: rangeStart } },
        { paidAt: null, createdAt: { lt: rangeStart } },
      ],
    },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    select: { fiscalIntegrityHash: true },
  })
  return prev?.fiscalIntegrityHash ?? FISCAL_REGION_GENESIS
}

// ── P&L Mensile ───────────────────────────────────────────────────────────────

reportsRouter.get('/pl', requirePermission('reports.read'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = reportYearMonthQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Parametri non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = req.restaurantId!
  const { year: y, month: m } = parsed.data

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const fiscal = buildFiscalConfig(restaurant?.settings)
  const timeZone = restaurant?.timezone ?? fiscal.timezone

  const { start: startDate, end: endDate } = buildMonthRangeInTimezone(y, m, timeZone)
  const orderWhere = paidOrdersInPeriodWhere(restaurantId, startDate, endDate)

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
      const lineCost = link.quantity * moneyNumber(link.inventoryItem.cost) * item.quantity
      estimatedFoodCost = Math.round((estimatedFoodCost + lineCost) * 100) / 100
    }
  }

  // Costo personale stimato (ore lavorate × tariffa media)
  const hourlyRate = restaurant?.settings?.laborHourlyRate ?? 12

  const shifts = await prisma.shift.findMany({
    where: {
      restaurantId,
      status: 'COMPLETED',
      date: { gte: startDate, lte: endDate },
    },
  })

  const HOURLY_RATE = hourlyRate
  let laborCost = 0
  for (const s of shifts) {
    const [sh, sm] = s.startTime.split(':').map(Number)
    const [eh, em] = s.endTime.split(':').map(Number)
    const hours = (eh * 60 + em - (sh * 60 + sm)) / 60
    laborCost += Math.max(0, hours) * HOURLY_RATE
  }

  const revenue = sumFoodFromMoneyAgg(revenueData)
  const tips = moneyNumber(revenueData._sum.tipAmount)
  const collected = moneyNumber(revenueData._sum.total)
  const grossProfit = revenue - estimatedFoodCost
  const netProfit = grossProfit - laborCost
  const foodCostPct = revenue > 0 ? (estimatedFoodCost / revenue) * 100 : 0
  const laborCostPct = revenue > 0 ? (laborCost / revenue) * 100 : 0

  // Breakdown giornaliero
  const dailyOrders = await prisma.order.findMany({
    where: orderWhere,
    select: { revenueAmount: true, tipAmount: true, total: true, paidAt: true, createdAt: true, discount: true, subtotal: true, tax: true },
    orderBy: { paidAt: 'asc' },
  })

  const dailyMap: Record<string, { revenue: number; tips: number; collected: number; orders: number; discount: number }> = {}
  for (const o of dailyOrders) {
    const paid = effectivePaidAt(o.paidAt, o.createdAt)
    const key = calendarDateInTimezone(timeZone, paid)
    if (!dailyMap[key]) dailyMap[key] = { revenue: 0, tips: 0, collected: 0, orders: 0, discount: 0 }
    const food = moneyNumber(o.revenueAmount) || (moneyNumber(o.subtotal) + moneyNumber(o.tax))
    dailyMap[key].revenue += food
    dailyMap[key].tips += moneyNumber(o.tipAmount)
    dailyMap[key].collected += moneyNumber(o.total)
    dailyMap[key].orders += 1
    dailyMap[key].discount += moneyNumber(o.discount)
  }

  const dailyBreakdown = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

  res.json({
    period: { year: y, month: m, startDate, endDate },
    summary: {
      revenue: Math.round(revenue * 100) / 100,
      tips: Math.round(tips * 100) / 100,
      collected: Math.round(collected * 100) / 100,
      subtotal: Math.round(moneyNumber(revenueData._sum.subtotal) * 100) / 100,
      tax: Math.round(moneyNumber(revenueData._sum.tax) * 100) / 100,
      totalDiscount: Math.round(moneyNumber(revenueData._sum.discount) * 100) / 100,
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
}))

// ── Food Cost per Piatto ───────────────────────────────────────────────────────

reportsRouter.get('/food-cost', requirePermission('reports.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const fiscal = buildFiscalConfig(restaurant?.settings)
  const timeZone = restaurant?.timezone ?? fiscal.timezone

  const menuItems = await prisma.menuItem.findMany({
    where: { restaurantId },
    include: {
      category: { select: { name: true } },
      inventoryLinks: { include: { inventoryItem: { select: { name: true, unit: true, cost: true } } } },
    },
  })

  // Vendite ultimi 30 giorni sul calendario tenant.
  const todayKey = calendarDateInTimezone(timeZone, new Date())
  const thirtyDaysAgoRef = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
  const fromKey = calendarDateInTimezone(timeZone, thirtyDaysAgoRef)
  const { start: thirtyDaysAgo, end: thirtyDaysEnd } = buildDateRangeForTimezone(
    { mode: 'range', from: fromKey, to: todayKey },
    timeZone,
  ) ?? { start: startOfLocalDay(new Date()), end: endOfLocalDay(new Date()) }

  const salesData = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      order: paidOrdersInPeriodWhere(restaurantId, thirtyDaysAgo, thirtyDaysEnd),
    },
    _sum: { quantity: true },
  })

  const salesMap = new Map(salesData.map(s => [s.menuItemId, s._sum.quantity || 0]))

  const items = menuItems.map(item => {
    const ingredientCost = item.inventoryLinks.reduce(
      (sum, link) => sum + link.quantity * moneyNumber(link.inventoryItem.cost),
      0,
    )
    const price = moneyNumber(item.price)
    const margin = price - ingredientCost
    const marginPct = price > 0 ? (margin / price) * 100 : 0
    const soldQty = salesMap.get(item.id) || 0
    const totalRevenue = price * soldQty
    const totalCost = ingredientCost * soldQty

    return {
      id: item.id,
      name: item.name,
      category: item.category.name,
      price,
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
        cost: moneyNumber(l.inventoryItem.cost),
      })),
    }
  })

  items.sort((a, b) => b.marginPct - a.marginPct)

  res.json(items)
})

// ── Analisi per categoria ──────────────────────────────────────────────────────

reportsRouter.get('/categories', requirePermission('reports.read'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = reportDaysQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Parametri non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = req.restaurantId!
  const dayCount = parsed.data.days
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const fiscal = buildFiscalConfig(restaurant?.settings)
  const timeZone = restaurant?.timezone ?? fiscal.timezone
  const toKey = calendarDateInTimezone(timeZone, new Date())
  const fromRef = new Date(Date.now() - (dayCount - 1) * 24 * 60 * 60 * 1000)
  const fromKey = calendarDateInTimezone(timeZone, fromRef)
  const { start: since, end: until } = buildDateRangeForTimezone(
    { mode: 'range', from: fromKey, to: toKey },
    timeZone,
  ) ?? { start: startOfLocalDay(new Date()), end: endOfLocalDay(new Date()) }

  const orderItems = await prisma.orderItem.findMany({
    where: {
      status: { not: 'CANCELLED' },
      order: paidOrdersInPeriodWhere(restaurantId, since, until),
    },
    select: {
      quantity: true,
      unitPrice: true,
      modifiers: { select: { price: true } },
      menuItem: { select: { category: { select: { name: true } } } },
    },
  })

  const categoryMap: Record<string, { name: string; revenue: number; qty: number }> = {}
  for (const item of orderItems) {
    const catName = item.menuItem.category.name
    const modifierTotal = item.modifiers.reduce((s, m) => s + moneyNumber(m.price), 0)
    const lineRevenue = (moneyNumber(item.unitPrice) + modifierTotal) * item.quantity
    if (!categoryMap[catName]) categoryMap[catName] = { name: catName, revenue: 0, qty: 0 }
    categoryMap[catName].qty += item.quantity
    categoryMap[catName].revenue += lineRevenue
  }

  const result = Object.values(categoryMap)
    .map(c => ({ ...c, revenue: Math.round(c.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)

  res.json(result)
}))

// ── Trend mensili annuali ──────────────────────────────────────────────────────

reportsRouter.get('/yearly', requirePermission('reports.read'), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = reportYearQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: 'Parametri non validi', details: parsed.error.flatten() })
    return
  }

  const restaurantId = req.restaurantId!
  const y = parsed.data.year

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const fiscal = buildFiscalConfig(restaurant?.settings)
  const yearTimeZone = restaurant?.timezone ?? fiscal.timezone
  const monthLocale = fiscal.defaultLocale === 'es' || fiscal.defaultLocale === 'es-cn'
    ? 'es-ES'
    : fiscal.defaultLocale === 'it'
      ? 'it-IT'
      : 'en-GB'

  const months = await Promise.all(
    Array.from({ length: 12 }, (_, index) => {
      const m = index + 1
      return (async () => {
        const { start, end } = buildMonthRangeInTimezone(y, m, yearTimeZone)
        const agg = await prisma.order.aggregate({
          where: paidOrdersInPeriodWhere(restaurantId, start, end),
          _sum: { revenueAmount: true, tipAmount: true, total: true, subtotal: true, tax: true },
          _count: true,
        })
        const foodRevenue = sumFoodFromMoneyAgg(agg)
        return {
          month: m,
          monthName: new Date(y, m - 1).toLocaleString(monthLocale, { month: 'short' }),
          revenue: Math.round(foodRevenue * 100) / 100,
          tips: Math.round(moneyNumber(agg._sum.tipAmount) * 100) / 100,
          collected: Math.round(moneyNumber(agg._sum.total) * 100) / 100,
          orders: agg._count,
        }
      })()
    }),
  )

  const totalRevenue = months.reduce((s, month) => s + month.revenue, 0)
  const bestMonth = months.reduce((best, month) => month.revenue > best.revenue ? month : best, months[0])

  res.json({ year: y, months, totalRevenue: Math.round(totalRevenue * 100) / 100, bestMonth })
}))

// ── Report fiscal (multi-nazione: IVA / IGIC) ─────────────────────────────────

reportsRouter.get('/fiscal', requireRole('OWNER'), requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const fiscalQuerySchema = z.object({
    mode: z.enum(['day', 'month', 'range']).optional(),
    year: z.string().optional(),
    month: z.string().optional(),
    date: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  const parsedQuery = fiscalQuerySchema.safeParse(req.query)
  if (!parsedQuery.success) {
    res.status(400).json({ error: 'Parametri query non validi' })
    return
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })

  if (!restaurant) {
    res.status(404).json({ error: 'Ristorante non trovato' })
    return
  }

  const fiscal = buildFiscalConfig(restaurant.settings)
  const timeZone = restaurant.timezone ?? fiscal.timezone
  const queryData = parsedQuery.data
  const range = buildDateRangeForTimezone(queryData as Record<string, string | undefined>, timeZone)
  if (!range) {
    res.status(400).json({ error: 'Filtro date non valido' })
    return
  }
  if (!isFiscalRangeWithinLimit(range.start, range.end)) {
    res.status(400).json({
      error: 'Intervallo troppo ampio',
      code: 'FISCAL_RANGE_TOO_LARGE',
      maxDays: MAX_FISCAL_RANGE_DAYS,
    })
    return
  }

  const orders = await fetchPaidOrdersInPeriod(restaurantId, range.start, range.end)
  const strategy = getFiscalStrategyFromConfig(fiscal)

  const rows = orders.map(o => {
    const row = buildFiscalTransactionRow(o, effectivePaidAt(o.paidAt, o.createdAt), fiscal.taxRate)
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
      fiscalRegionSnapshot: o.fiscalRegionSnapshot ?? fiscal.fiscalRegion,
    }
  })

  const initialExpectedPrev = await resolveChainInitialPrevHash(restaurantId, range.start)
  const chainAudit = verifyFiscalChainSequence(
    orders.map(o => ({
      id: o.id,
      fiscalClosedAt: o.fiscalClosedAt,
      total: moneyNumber(o.total),
      fiscalPrevHash: o.fiscalPrevHash,
      fiscalIntegrityHash: o.fiscalIntegrityHash,
      paidAt: o.paidAt,
    })),
    { initialExpectedPrev },
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
    period: { mode: queryData.mode ?? 'month', start: range.start.toISOString(), end: range.end.toISOString() },
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

// ── Liquidazione IVA/IGIC per aliquota ────────────────────────────────────────

reportsRouter.get('/fiscal/vat-breakdown', requireRole('OWNER'), requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  // RC-04: use tenant timezone for date range (same as /fiscal)
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const fiscal = buildFiscalConfig(restaurant?.settings)
  const timeZone = restaurant?.timezone ?? fiscal.timezone
  const range = buildDateRangeForTimezone(req.query as Record<string, string | undefined>, timeZone)
  if (!range) {
    res.status(400).json({ error: 'Filtro date non valido' })
    return
  }
  if (!isFiscalRangeWithinLimit(range.start, range.end)) {
    res.status(400).json({
      error: 'Intervallo troppo ampio',
      code: 'FISCAL_RANGE_TOO_LARGE',
      maxDays: MAX_FISCAL_RANGE_DAYS,
    })
    return
  }

  const orders = await fetchPaidOrdersInPeriod(restaurantId, range.start, range.end)
  const byRate = new Map<number, { taxRate: number; taxableBase: number; tax: number; count: number }>()

  for (const o of orders) {
    const rate = o.taxRateApplied ?? 0
    const base = moneyNumber(o.subtotal)
    const tax = moneyNumber(o.tax)
    const bucket = byRate.get(rate) ?? { taxRate: rate, taxableBase: 0, tax: 0, count: 0 }
    bucket.taxableBase = Math.round((bucket.taxableBase + base) * 100) / 100
    bucket.tax = Math.round((bucket.tax + tax) * 100) / 100
    bucket.count += 1
    byRate.set(rate, bucket)
  }

  const breakdown = [...byRate.values()].sort((a, b) => a.taxRate - b.taxRate)
  res.json({
    period: { start: range.start.toISOString(), end: range.end.toISOString() },
    breakdown,
    totals: {
      taxableBase: Math.round(breakdown.reduce((s, r) => s + r.taxableBase, 0) * 100) / 100,
      tax: Math.round(breakdown.reduce((s, r) => s + r.tax, 0) * 100) / 100,
      orders: orders.length,
    },
  })
})

// ── Chiusura Fiscale Zeta (Aruba FE) ──────────────────────────────────────────

reportsRouter.get('/zeta', requireRole('OWNER'), requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const closures = await prisma.fiscalClosure.findMany({
    where: { restaurantId },
    orderBy: { date: 'desc' },
    take: 90,
  })
  res.json(closures)
})

reportsRouter.post('/zeta', requireRole('OWNER'), requireProPlan, async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  const bodyParsed = bodySchema.safeParse(req.body ?? {})
  if (!bodyParsed.success) {
    res.status(400).json({ error: 'Data chiusura non valida (YYYY-MM-DD)' })
    return
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  if (!restaurant?.settings) {
    res.status(400).json({ error: 'Impostazioni ristorante non trovate' })
    return
  }

  const fiscal = buildFiscalConfig(restaurant.settings)
  const zetaTimeZone = restaurant.timezone ?? fiscal.timezone
  if (fiscal.countryCode !== 'IT') {
    res.status(400).json({ error: 'Chiusura Zeta disponibile solo per tenant Italia' })
    return
  }

  const targetDateStr = bodyParsed.data.date ?? calendarDateInTimezone(zetaTimeZone)
  const { gte: startOfDay, lt: endExclusive } = dayBoundsInTimezone(targetDateStr, zetaTimeZone)
  const endOfDay = new Date(endExclusive.getTime() - 1)

  const dayKey = targetDateStr
  const existing = await prisma.fiscalClosure.findFirst({
    where: {
      restaurantId,
      date: { gte: startOfDay, lte: endOfDay },
    },
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
  let totalStripe = 0
  let totalDigital = 0
  let totalVoucher = 0
  let totalTip = 0

  for (const o of orders) {
    totalRevenue += moneyNumber(o.revenueAmount) || (moneyNumber(o.subtotal) + moneyNumber(o.tax))
    totalTax += moneyNumber(o.tax)
    totalTip += moneyNumber(o.tipAmount)
    const orderTotal = moneyNumber(o.total)
    switch (o.paymentMethod) {
      case 'CASH':
        totalCash += orderTotal
        break
      case 'STRIPE':
        totalStripe += orderTotal
        break
      case 'DIGITAL':
        totalDigital += orderTotal
        break
      case 'VOUCHER':
        totalVoucher += orderTotal
        break
      default:
        if (o.paymentMethod) totalCard += orderTotal
        break
    }
  }

  // 3. Genera il record di Chiusura (unique su calendarDay → anti-race)
  let closure
  try {
    closure = await prisma.fiscalClosure.create({
      data: {
        restaurantId,
        calendarDay: dayKey,
        date: new Date(),
        totalRevenue: toMoney(totalRevenue),
        totalTax: toMoney(totalTax),
        totalCash: toMoney(totalCash),
        totalCard: toMoney(totalCard),
        totalStripe: toMoney(totalStripe),
        totalDigital: toMoney(totalDigital),
        totalVoucher: toMoney(totalVoucher),
        totalTip: toMoney(totalTip),
        orderCount: orders.length,
        status: 'GENERATED',
      },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Chiusura fiscale già effettuata per oggi.' })
      return
    }
    throw err
  }

  res.json({ ...closure, calendarDay: dayKey, paymentSplit: { totalCash, totalCard, totalStripe, totalDigital, totalVoucher } })
})
