import { prisma } from './prisma'
import {
  runPredictiveEngine,
  buildWeatherForecast,
  aggregateInventoryDemand,
  computeDishTrend,
  type InventoryInput,
  type ExpectedDemandMap,
  type PastSaleRecord,
  type PredictiveEngineOutput,
  type SmartAlert,
  type AffluenceForecastDay,
} from './predictiveEngine'
import {
  fetchOpenMeteoForecast,
  resolveRestaurantCoordinates,
} from './weatherService'

export type {
  WeatherCondition,
  AlertSeverity,
  SmartAlert as PredictiveAlert,
  AffluenceForecastDay,
  PredictiveEngineOutput,
} from './predictiveEngine'

export { getDayI18nKey } from './predictiveEngine'

import {
  buildDishTrendsPayload,
  buildInventoryForecast,
  buildPredictiveInsights,
  type DishTrendItem,
  type InventoryForecastItem,
  type PredictiveInsight,
} from './predictivePayload'
import { buildSuggestedActions, type SuggestedAction } from './suggestedActions'

export type {
  InventoryForecastItem,
  DishTrendItem,
  PredictiveInsight,
} from './predictivePayload'
export type { SuggestedAction } from './suggestedActions'

export interface PredictiveAIResult {
  forecast: AffluenceForecastDay[]
  alerts: SmartAlert[]
  factorsUsed: ('orderHistory' | 'dayOfWeek' | 'weather' | 'reservations')[]
  engineVersion: string
  generatedAt: string
  weatherSource?: 'open-meteo' | 'simulated'
  inventoryForecast: InventoryForecastItem[]
  dishTrends: DishTrendItem[]
  insights: PredictiveInsight[]
  suggestedActions: SuggestedAction[]
  hasRecipeLinks: boolean
}

function weeksAgo(n: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n * 7)
  return d
}

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]!
}

/**
 * Carica dati dal DB, meteo Open-Meteo (gratuito) e delega al motore statistico.
 */
export async function runPredictiveAnalysis(restaurantId: string): Promise<PredictiveAIResult> {
  const windowStart = weeksAgo(8)
  const yoyStart = weeksAgo(56)
  const yoyEnd = weeksAgo(52)
  const forecastEnd = new Date()
  forecastEnd.setDate(forecastEnd.getDate() + 7)

  const paidOrderWhere = {
    restaurantId,
    status: 'PAID' as const,
    refundedAt: null,
    OR: [
      { paidAt: { gte: windowStart } },
      { paidAt: null, createdAt: { gte: windowStart } },
      { paidAt: { gte: yoyStart, lt: yoyEnd } },
      { paidAt: null, createdAt: { gte: yoyStart, lt: yoyEnd } },
    ],
  }

  const itemOrderDateFilter = {
    OR: [
      { createdAt: { gte: windowStart } },
      { createdAt: { gte: yoyStart, lt: yoyEnd } },
    ],
  }

  const resDateFilter = {
    OR: [
      { date: { gte: weeksAgo(12) } },
      { date: { gte: yoyStart, lte: yoyEnd } },
    ],
  }

  const [
    paidOrders,
    inventoryRows,
    orderItems,
    menuItems,
    reservations,
    restaurant,
  ] = await Promise.all([
    prisma.order.findMany({
      where: paidOrderWhere,
      select: {
        createdAt: true,
        paidAt: true,
        type: true,
        tableId: true,
        table: { select: { seats: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      where: { restaurantId },
      include: {
        menuLinks: { select: { menuItemId: true, quantity: true } },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId,
          ...itemOrderDateFilter,
          status: { notIn: ['CANCELLED'] },
        },
      },
      select: {
        menuItemId: true,
        quantity: true,
        createdAt: true,
        menuItem: { select: { name: true } },
      },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId },
      select: { id: true, name: true },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId,
        ...resDateFilter,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: { date: true, covers: true, status: true },
    }),
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { settings: true },
    }),
  ])

  // Storico coperti reali: tavoli (seats) per dine-in, 1 per asporto, prenotazioni completate
  const coverHistory: PastSaleRecord[] = []

  for (const order of paidOrders) {
    let covers = 1
    if (order.type === 'DINE_IN' && order.table?.seats) {
      covers = order.table.seats
    }
    const effectiveDate = order.paidAt ?? order.createdAt
    coverHistory.push({
      date: effectiveDate,
      quantity: covers,
      dayOfWeek: effectiveDate.getDay(),
    })
  }

  for (const res of reservations.filter(r => ['COMPLETED', 'SEATED'].includes(r.status))) {
    coverHistory.push({
      date: res.date,
      quantity: res.covers,
      dayOfWeek: res.date.getDay(),
    })
  }

  const reservationHistory: PastSaleRecord[] = reservations
    .filter(r => ['COMPLETED', 'SEATED', 'CONFIRMED'].includes(r.status))
    .map(r => ({
      date: r.date,
      quantity: r.covers,
      dayOfWeek: r.date.getDay(),
    }))

  const upcomingReservations: Record<string, number> = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (const res of reservations.filter(r => ['CONFIRMED', 'PENDING', 'SEATED'].includes(r.status))) {
    const resDate = new Date(res.date)
    resDate.setHours(0, 0, 0, 0)
    if (resDate >= today && resDate <= forecastEnd) {
      const key = toDateKey(resDate)
      upcomingReservations[key] = (upcomingReservations[key] ?? 0) + res.covers
    }
  }

  const salesByMenuItem = new Map<string, PastSaleRecord[]>()
  for (const oi of orderItems) {
    const list = salesByMenuItem.get(oi.menuItemId) ?? []
    list.push({
      date: oi.createdAt,
      quantity: oi.quantity,
      dayOfWeek: oi.createdAt.getDay(),
    })
    salesByMenuItem.set(oi.menuItemId, list)
  }

  const expectedDemand: ExpectedDemandMap = {}
  const inventory: InventoryInput[] = inventoryRows.map(row => ({
    id: row.id,
    name: row.name,
    currentQuantity: row.quantity,
    minimumThreshold: row.minQuantity,
    unit: row.unit,
    category: row.category,
  }))

  for (const row of inventoryRows) {
    if (row.menuLinks.length > 0) {
      expectedDemand[row.id] = aggregateInventoryDemand(
        row.id,
        row.menuLinks.map(link => ({
          menuItemId: link.menuItemId,
          recipeQty: link.quantity,
          pastSales: salesByMenuItem.get(link.menuItemId) ?? [],
        })),
      )
    }
  }

  const dishTrends = menuItems.map(m =>
    computeDishTrend(m.id, m.name, salesByMenuItem.get(m.id) ?? []),
  )

  // Meteo reale via Open-Meteo (gratuito)
  let weatherForecast = buildWeatherForecast()
  let weatherSource: 'open-meteo' | 'simulated' = 'simulated'

  const settings = restaurant?.settings
  let coords = await resolveRestaurantCoordinates({
    legalAddress: settings?.legalAddress,
    address: restaurant?.address,
    countryCode: settings?.countryCode,
    latitude: settings?.latitude,
    longitude: settings?.longitude,
  })

  if (coords && settings && (settings.latitude == null || settings.longitude == null)) {
    await prisma.restaurantSettings.update({
      where: { restaurantId },
      data: { latitude: coords.lat, longitude: coords.lon },
    })
  }

  if (coords) {
    const liveForecast = await fetchOpenMeteoForecast(coords)
    if (liveForecast) {
      weatherForecast = liveForecast
      weatherSource = 'open-meteo'
    }
  }

  const hasRecipeLinks = inventoryRows.some(row => row.menuLinks.length > 0)

  const result = runPredictiveEngine({
    inventory,
    expectedDemand,
    coverHistory,
    reservationHistory,
    upcomingReservations,
    dishTrends,
    weatherForecast,
    weatherSource,
  })

  const inventoryForecast = buildInventoryForecast(inventory, expectedDemand, result.forecast)
  const dishTrendsPayload = buildDishTrendsPayload(dishTrends)
  const insights = buildPredictiveInsights({
    forecast: result.forecast,
    inventoryForecast,
    dishTrends: dishTrendsPayload,
  })
  const suggestedActions = buildSuggestedActions({
    alerts: result.alerts,
    inventoryForecast,
    dishTrends: dishTrendsPayload,
  })

  return {
    forecast: result.forecast,
    alerts: result.alerts,
    factorsUsed: result.factorsUsed,
    engineVersion: result.engineVersion,
    generatedAt: result.generatedAt,
    weatherSource: result.weatherSource,
    inventoryForecast,
    dishTrends: dishTrendsPayload,
    insights,
    suggestedActions,
    hasRecipeLinks,
  }
}
