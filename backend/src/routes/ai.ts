import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { runPredictiveAnalysis } from '../lib/predictiveAI'

export const aiRouter = Router()

// ── helpers ────────────────────────────────────────────────────────────────────

const DAYS_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

function startOfDay(d: Date) {
  const c = new Date(d); c.setHours(0, 0, 0, 0); return c
}
function weeksAgo(n: number) {
  const d = startOfDay(new Date()); d.setDate(d.getDate() - n * 7); return d
}
function daysAgo(n: number) {
  const d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d
}

// ── 1. PREVISIONE DOMANDA ─────────────────────────────────────────────────────
// Analisi storica per giorno della settimana → previsione prossimi 7 giorni
aiRouter.get('/forecast', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  // Ultimi 12 settimane — aggregato SQL per giorno settimana (meno RAM)
  type DowRow = { dow: number; totalRevenue: number; totalCovers: number; count: number }
  const since = weeksAgo(12)
  const grouped = await prisma.$queryRaw<DowRow[]>`
    SELECT
      EXTRACT(DOW FROM o."createdAt")::int AS dow,
      COALESCE(SUM(o.total), 0)::float AS "totalRevenue",
      COALESCE(SUM(oi.qty), 0)::int AS "totalCovers",
      COUNT(o.id)::int AS count
    FROM "Order" o
    LEFT JOIN (
      SELECT "orderId", SUM(quantity) AS qty FROM "OrderItem" GROUP BY "orderId"
    ) oi ON oi."orderId" = o.id
    WHERE o."restaurantId" = ${restaurantId}
      AND o."createdAt" >= ${since}
      AND o.status <> 'CANCELLED'
    GROUP BY 1
  `

  const momentumOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      createdAt: { gte: since },
      status: { notIn: ['CANCELLED'] },
    },
    select: { createdAt: true, total: true },
  })

  // Raggruppa per giorno della settimana (0=dom … 6=sab)
  const byDow: Record<number, { totalRevenue: number; totalCovers: number; count: number }> = {}
  for (let i = 0; i < 7; i++) byDow[i] = { totalRevenue: 0, totalCovers: 0, count: 0 }
  for (const row of grouped) {
    byDow[row.dow] = {
      totalRevenue: row.totalRevenue,
      totalCovers: row.totalCovers,
      count: row.count,
    }
  }

  // Previsione prossimi 7 giorni
  const forecast = []
  for (let i = 1; i <= 7; i++) {
    const date = new Date(); date.setDate(date.getDate() + i)
    const dow = date.getDay()
    const stats = byDow[dow]
    const weeks = stats.count || 1
    const avgRevenue = stats.totalRevenue / weeks
    const avgCovers = stats.totalCovers / weeks

    // Trend delle ultime 4 settimane vs 8 settimane precedenti (momentum)
    const recent4 = momentumOrders.filter(o => {
      const d = o.createdAt.getDay()
      return d === dow && o.createdAt >= weeksAgo(4)
    })
    const prev8 = momentumOrders.filter(o => {
      const d = o.createdAt.getDay()
      return d === dow && o.createdAt >= weeksAgo(12) && o.createdAt < weeksAgo(4)
    })
    const recentAvg = recent4.length
      ? recent4.reduce((s, o) => s + o.total, 0) / recent4.length
      : avgRevenue
    const prevAvg = prev8.length
      ? prev8.reduce((s, o) => s + o.total, 0) / prev8.length
      : avgRevenue

    const trendPct = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0
    const confidence = Math.min(95, 50 + stats.count * 3)

    // Consiglio operativo basato sulla previsione
    let suggestion = ''
    if (avgRevenue > 0) {
      if (trendPct > 10) suggestion = `Tendenza in crescita (+${trendPct.toFixed(0)}%). Prepara scorte extra.`
      else if (trendPct < -10) suggestion = `Tendenza in calo (${trendPct.toFixed(0)}%). Riduci acquisti.`
      else suggestion = `Andamento stabile. Scorte standard.`
    } else {
      suggestion = 'Dati insufficienti per una previsione affidabile.'
    }

    forecast.push({
      date: date.toISOString().split('T')[0],
      dayLabel: DAYS_IT[dow],
      predictedRevenue: Math.round(avgRevenue * 100) / 100,
      predictedCovers: Math.round(avgCovers),
      trend: Math.round(trendPct * 10) / 10,
      confidence,
      suggestion,
      historicalSamples: stats.count,
    })
  }

  res.json({ forecast })
})

// ── 2. SUGGERIMENTI RIORDINO SCORTE ──────────────────────────────────────────
// Calcola velocità di consumo per ogni prodotto e suggerisce la quantità da ordinare
aiRouter.get('/reorder', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const [inventory, recentOrderItems] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { restaurantId },
      include: { menuLinks: { include: { menuItem: true } } },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          createdAt: { gte: daysAgo(14) },
          status: { notIn: ['CANCELLED'] },
        },
      },
      select: { menuItemId: true, quantity: true },
    }),
  ])

  // Mappa menuItemId → quantità venduta in 14 giorni
  const soldByMenuItem: Record<string, number> = {}
  for (const oi of recentOrderItems) {
    soldByMenuItem[oi.menuItemId] = (soldByMenuItem[oi.menuItemId] || 0) + oi.quantity
  }

  const suggestions = inventory.map(item => {
    // Consumo giornaliero basato sui piatti collegati
    let dailyConsumption = 0
    for (const link of item.menuLinks) {
      const sold14d = soldByMenuItem[link.menuItemId] || 0
      dailyConsumption += (sold14d / 14) * link.quantity
    }

    const daysLeft = dailyConsumption > 0 ? item.quantity / dailyConsumption : 999
    const daysToOrder = 3 // lead time standard 3 giorni
    const bufferDays = 7  // buffer di sicurezza 7 giorni
    const reorderPoint = dailyConsumption * (daysToOrder + bufferDays)
    const suggestedQty = Math.max(0, Math.ceil(dailyConsumption * 14 - item.quantity))

    let urgency: 'critical' | 'warning' | 'ok' | 'idle' = 'ok'
    let reason = ''

    if (item.quantity <= item.minQuantity) {
      urgency = 'critical'
      reason = `Sotto scorta minima (${item.minQuantity} ${item.unit})`
    } else if (daysLeft < daysToOrder + 2 && dailyConsumption > 0) {
      urgency = 'critical'
      reason = `Esaurimento in ${Math.floor(daysLeft)} giorni (sotto lead time)`
    } else if (item.quantity <= reorderPoint && dailyConsumption > 0) {
      urgency = 'warning'
      reason = `Raggiunto punto di riordino (${Math.floor(daysLeft)} giorni rimasti)`
    } else if (dailyConsumption === 0) {
      urgency = 'idle'
      reason = 'Nessun consumo negli ultimi 14 giorni'
    } else {
      reason = `Scorte per ${Math.floor(daysLeft)} giorni`
    }

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentQty: item.quantity,
      minQty: item.minQuantity,
      dailyConsumption: Math.round(dailyConsumption * 100) / 100,
      daysLeft: daysLeft < 999 ? Math.round(daysLeft * 10) / 10 : null,
      suggestedOrderQty: suggestedQty,
      urgency,
      reason,
      supplier: item.supplier,
      estimatedCost: suggestedQty * item.cost,
    }
  })

  // Ordina per urgenza
  const order: Record<string, number> = { critical: 0, warning: 1, ok: 2, idle: 3 }
  suggestions.sort((a, b) => order[a.urgency] - order[b.urgency])

  const summary = {
    critical: suggestions.filter(s => s.urgency === 'critical').length,
    warning: suggestions.filter(s => s.urgency === 'warning').length,
    totalCost: suggestions.reduce((s, i) => s + i.estimatedCost, 0),
  }

  res.json({ suggestions, summary })
})

// ── 3. MATRICE MENU (BCG) ─────────────────────────────────────────────────────
// Classifica ogni piatto: Star / Plowhorse / Puzzle / Dog
aiRouter.get('/menu-matrix', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  // Vendite ultimi 30 giorni
  const [items, orderItems] = await Promise.all([
    prisma.menuItem.findMany({
      where: { restaurantId },
      include: { category: { select: { name: true } } },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          createdAt: { gte: daysAgo(30) },
          status: { notIn: ['CANCELLED'] },
        },
      },
      select: { menuItemId: true, quantity: true, unitPrice: true },
    }),
  ])

  // Aggregazione per piatto
  const statsMap: Record<string, { qty: number; revenue: number }> = {}
  for (const oi of orderItems) {
    if (!statsMap[oi.menuItemId]) statsMap[oi.menuItemId] = { qty: 0, revenue: 0 }
    statsMap[oi.menuItemId].qty += oi.quantity
    statsMap[oi.menuItemId].revenue += oi.quantity * oi.unitPrice
  }

  const enriched = items.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category.name,
    price: item.price,
    available: item.available,
    qty30d: statsMap[item.id]?.qty || 0,
    revenue30d: statsMap[item.id]?.revenue || 0,
  }))

  // Soglie mediane per classificazione
  const allQty = enriched.map(i => i.qty30d)
  const allMargin = enriched.map(i => i.price)
  allQty.sort((a, b) => a - b)
  allMargin.sort((a, b) => a - b)
  const medianQty = allQty[Math.floor(allQty.length / 2)] || 1
  const medianMargin = allMargin[Math.floor(allMargin.length / 2)] || 1

  const matrix = enriched.map(item => {
    const highVolume = item.qty30d >= medianQty
    const highMargin = item.price >= medianMargin

    let quadrant: 'star' | 'plowhorse' | 'puzzle' | 'dog'
    let label: string
    let action: string
    let color: string

    if (highVolume && highMargin) {
      quadrant = 'star'; label = '⭐ Star'
      action = 'Mantieni in evidenza. Ingredienti sempre in stock.'
      color = '#f59e0b'
    } else if (highVolume && !highMargin) {
      quadrant = 'plowhorse'; label = '🐴 Trainante'
      action = `Valuta aumento prezzo (+€1–2). Alto volume compensa il margine basso.`
      color = '#3b82f6'
    } else if (!highVolume && highMargin) {
      quadrant = 'puzzle'; label = '🔮 Potenziale'
      action = 'Poco ordinato ma margine alto. Promuovilo in evidenza o nel menu QR.'
      color = '#8b5cf6'
    } else {
      quadrant = 'dog'; label = '🐕 Da rivedere'
      action = item.qty30d === 0
        ? 'Non ordinato in 30 giorni. Considera di rimuoverlo dal menu.'
        : 'Basso volume e margine. Valuta rimozione o reformulation.'
      color = '#94a3b8'
    }

    return { ...item, quadrant, label, action, color }
  })

  const summary = {
    stars: matrix.filter(i => i.quadrant === 'star').length,
    plowhorses: matrix.filter(i => i.quadrant === 'plowhorse').length,
    puzzles: matrix.filter(i => i.quadrant === 'puzzle').length,
    dogs: matrix.filter(i => i.quadrant === 'dog').length,
    totalRevenue30d: matrix.reduce((s, i) => s + i.revenue30d, 0),
    topItem: matrix.sort((a, b) => b.revenue30d - a.revenue30d)[0]?.name || '',
  }

  res.json({ matrix, summary, medianQty, medianMargin })
})

// ── 4. ALERT INTELLIGENTI ─────────────────────────────────────────────────────
// Anomalie, cali, opportunità rilevate automaticamente
aiRouter.get('/alerts', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const alerts: {
    id: string
    type: 'danger' | 'warning' | 'success' | 'info'
    title: string
    description: string
    value?: string
    action?: string
  }[] = []

  const today = startOfDay(new Date())
  const yesterday = daysAgo(1)
  const weekAgo = daysAgo(7)
  const twoWeeksAgo = daysAgo(14)

  const [
    thisWeekRevenue,
    lastWeekRevenue,
    lowStock,
    todayOrders,
    yesterdayOrders,
    topCustomers,
    inactiveItems,
    reservationsToday,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { restaurantId, status: 'PAID', paidAt: { gte: weekAgo } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { restaurantId, status: 'PAID', paidAt: { gte: twoWeeksAgo, lt: weekAgo } },
      _sum: { total: true },
    }),
    prisma.inventoryItem.findMany({
      where: { restaurantId, quantity: { lte: prisma.inventoryItem.fields.minQuantity } },
    }).catch(() => [] as typeof prisma.inventoryItem extends { findMany: (...a: unknown[]) => infer R } ? Awaited<R> : never[]),
    prisma.order.count({ where: { restaurantId, createdAt: { gte: today }, status: { notIn: ['CANCELLED'] } } }),
    prisma.order.count({ where: { restaurantId, createdAt: { gte: yesterday, lt: today }, status: { notIn: ['CANCELLED'] } } }),
    prisma.customer.findMany({
      where: { restaurantId, lastVisit: { lt: daysAgo(60) } },
      orderBy: { totalSpent: 'desc' },
      take: 5,
    }),
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: { order: { restaurantId, createdAt: { gte: daysAgo(30) }, status: { notIn: ['CANCELLED'] } } },
      _count: true,
      having: { menuItemId: { _count: { equals: 0 } } },
    }).catch(() => []),
    prisma.reservation.count({
      where: { restaurantId, date: { gte: today, lt: new Date(today.getTime() + 86400000) }, status: { notIn: ['CANCELLED'] } },
    }),
  ])

  // Alert ricavo settimana
  const thisW = thisWeekRevenue._sum?.total ?? 0
  const lastW = lastWeekRevenue._sum?.total ?? 0
  if (lastW > 0) {
    const diff = ((thisW - lastW) / lastW) * 100
    if (diff <= -15) {
      alerts.push({
        id: 'revenue-drop',
        type: 'danger',
        title: 'Calo ricavi settimanale',
        description: `I ricavi di questa settimana sono ${Math.abs(diff).toFixed(0)}% inferiori alla settimana scorsa.`,
        value: `${diff.toFixed(1)}%`,
        action: 'Analizza il report per identificare la causa',
      })
    } else if (diff >= 15) {
      alerts.push({
        id: 'revenue-up',
        type: 'success',
        title: 'Settimana in crescita',
        description: `I ricavi sono aumentati del ${diff.toFixed(0)}% rispetto alla settimana scorsa.`,
        value: `+${diff.toFixed(1)}%`,
      })
    }
  }

  // Alert ordini oggi vs ieri
  if (yesterdayOrders > 0) {
    const diffOrders = ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
    if (todayOrders > yesterdayOrders * 1.3) {
      alerts.push({
        id: 'busy-day',
        type: 'info',
        title: 'Giornata più intensa del solito',
        description: `Oggi ${todayOrders} ordini (+${diffOrders.toFixed(0)}% vs ieri). Monitora i tempi di cucina.`,
        value: `${todayOrders} ordini`,
      })
    }
  }

  // Alert scorte critiche
  const criticalStock = await prisma.inventoryItem.findMany({
    where: { restaurantId, quantity: { lte: prisma.inventoryItem.fields.minQuantity } },
    take: 5,
  })
  if (criticalStock.length > 0) {
    alerts.push({
      id: 'low-stock',
      type: 'danger',
      title: `${criticalStock.length} prodott${criticalStock.length > 1 ? 'i' : 'o'} sotto scorta minima`,
      description: criticalStock.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', '),
      action: 'Vai ai suggerimenti riordino',
    })
  }

  // Alert clienti inattivi VIP
  if (topCustomers.length > 0) {
    alerts.push({
      id: 'inactive-vip',
      type: 'warning',
      title: `${topCustomers.length} clienti fedeli non tornano da 60+ giorni`,
      description: `${topCustomers.slice(0, 3).map(c => c.name).join(', ')}${topCustomers.length > 3 ? '…' : ''} non visitano da oltre 2 mesi.`,
      action: 'Invia campagna "ti vogliamo rivedere" dal modulo Marketing',
    })
  }

  void lowStock
  void inactiveItems

  // Alert prenotazioni oggi
  if (reservationsToday > 0) {
    alerts.push({
      id: 'reservations-today',
      type: 'info',
      title: `${reservationsToday} prenotazion${reservationsToday > 1 ? 'i' : 'e'} oggi`,
      description: `Controlla la disponibilità del personale e le scorte per i piatti più richiesti.`,
      value: `${reservationsToday} tavoli`,
    })
  }

  // Insight picco orario
  const hourlyOrders = await prisma.order.findMany({
    where: { restaurantId, createdAt: { gte: daysAgo(30) }, status: { notIn: ['CANCELLED'] } },
    select: { createdAt: true, total: true },
  })
  const byHour: Record<number, { count: number; revenue: number }> = {}
  for (const o of hourlyOrders) {
    const h = o.createdAt.getHours()
    if (!byHour[h]) byHour[h] = { count: 0, revenue: 0 }
    byHour[h].count++
    byHour[h].revenue += o.total
  }
  const peakHour = Object.entries(byHour).sort((a, b) => b[1].revenue - a[1].revenue)[0]
  if (peakHour) {
    const h = parseInt(peakHour[0])
    alerts.push({
      id: 'peak-hour',
      type: 'info',
      title: 'Picco orario identificato',
      description: `Il tuo orario più redditizio è ${h}:00–${h + 1}:00. Assicurati di avere personale sufficiente in quella fascia.`,
      value: `${h}:00–${h + 1}:00`,
    })
  }

  // Piatto da riportare in evidenza
  const puzzleItem = await prisma.orderItem.groupBy({
    by: ['menuItemId'],
    where: {
      order: { restaurantId, createdAt: { gte: daysAgo(30) }, status: { notIn: ['CANCELLED'] } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'asc' } },
    take: 1,
  })
  if (puzzleItem.length > 0) {
    const mi = await prisma.menuItem.findUnique({ where: { id: puzzleItem[0].menuItemId } })
    if (mi && mi.price > 0) {
      alerts.push({
        id: 'hidden-gem',
        type: 'success',
        title: 'Piatto da promuovere',
        description: `"${mi.name}" è poco ordinato ma ha un buon prezzo (€${mi.price.toFixed(2)}). Mettilo in evidenza sul menu QR.`,
        action: 'Modifica il piatto e attiva "In evidenza"',
      })
    }
  }

  res.json({ alerts, generatedAt: new Date().toISOString() })
})

// ── 5. SOMMARIO AI (per widget dashboard) ─────────────────────────────────────
aiRouter.get('/summary', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDow = tomorrow.getDay()
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 84)

  const tomorrowOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { notIn: ['CANCELLED'] },
      createdAt: { gte: windowStart },
    },
    select: { createdAt: true, total: true, items: { select: { quantity: true } } },
  })

  const sameDayOrders = tomorrowOrders.filter(o => o.createdAt.getDay() === tomorrowDow)
  const avgRevenue = sameDayOrders.length
    ? sameDayOrders.reduce((s, o) => s + o.total, 0) / sameDayOrders.length
    : 0
  const avgCovers = sameDayOrders.length
    ? sameDayOrders.reduce((s, o) => s + o.items.reduce((c, i) => c + i.quantity, 0), 0) / sameDayOrders.length
    : 0

  const criticalStock = await prisma.inventoryItem.count({
    where: { restaurantId, quantity: { lte: prisma.inventoryItem.fields.minQuantity } },
  })

  res.json({
    tomorrow: {
      dayLabel: DAYS_IT[tomorrowDow],
      predictedRevenue: Math.round(avgRevenue * 100) / 100,
      predictedCovers: Math.round(avgCovers),
      samples: sameDayOrders.length,
    },
    criticalStock,
  })
})

// ── 6. AI PREDITTIVA MAGAZZINO E VENDITE ─────────────────────────────────────
aiRouter.get('/predictive', requirePermission('analytics.read'), async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await runPredictiveAnalysis(req.restaurantId!)
  res.json(result)
})
