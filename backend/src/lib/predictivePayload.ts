import type {
  AffluenceForecastDay,
  DishSalesTrend,
  ExpectedDemandMap,
  InventoryInput,
} from './predictiveEngine'
import { getDayI18nKey } from './predictiveEngine'

export type InventoryForecastStatus = 'ok' | 'low' | 'critical' | 'overstock'

export interface InventoryForecastItem {
  itemId: string
  itemName: string
  unit: string
  currentStock: number
  minStock: number
  demandNext7Days: number
  daysUntilStockout: number | null
  suggestedReorderQty: number
  status: InventoryForecastStatus
}

export type DishTrendDirection = 'up' | 'down' | 'stable'

export interface DishTrendItem {
  dishId: string
  dishName: string
  changePct: number
  direction: DishTrendDirection
}

export type InsightType = 'peak_day' | 'weather' | 'inventory' | 'trend'

export interface PredictiveInsight {
  id: string
  type: InsightType
  titleKey: string
  bodyKey: string
  params: Record<string, string | number>
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function resolveInventoryStatus(
  currentStock: number,
  minStock: number,
  demandNext7Days: number,
): InventoryForecastStatus {
  if (currentStock < minStock || (demandNext7Days > 0 && currentStock < demandNext7Days * 0.5)) {
    return 'critical'
  }
  if (demandNext7Days > currentStock) {
    return 'low'
  }
  if (demandNext7Days > 0 && currentStock > demandNext7Days * 2) {
    return 'overstock'
  }
  return 'ok'
}

/** Aggrega demand per articolo sui prossimi 7 giorni del forecast */
export function buildInventoryForecast(
  inventory: InventoryInput[],
  expectedDemand: ExpectedDemandMap,
  forecast: AffluenceForecastDay[],
): InventoryForecastItem[] {
  return inventory
    .filter(item => expectedDemand[item.id] != null)
    .map(item => {
      const profile = expectedDemand[item.id]!
      let demandNext7Days = 0

      for (const day of forecast) {
        demandNext7Days += profile[day.dayOfWeek]?.expectedQuantity ?? 0
      }
      demandNext7Days = round2(demandNext7Days)

      const dailyDemand = demandNext7Days / 7
      const daysUntilStockout = dailyDemand > 0
        ? Math.floor(item.currentQuantity / dailyDemand)
        : null

      const status = resolveInventoryStatus(
        item.currentQuantity,
        item.minimumThreshold,
        demandNext7Days,
      )

      const suggestedReorderQty = demandNext7Days > item.currentQuantity
        ? Math.ceil(Math.max(
          item.minimumThreshold,
          demandNext7Days - item.currentQuantity,
        ))
        : 0

      return {
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        currentStock: round2(item.currentQuantity),
        minStock: round2(item.minimumThreshold),
        demandNext7Days,
        daysUntilStockout,
        suggestedReorderQty,
        status,
      }
    })
    .sort((a, b) => {
      const order: Record<InventoryForecastStatus, number> = {
        critical: 0,
        low: 1,
        overstock: 2,
        ok: 3,
      }
      return order[a.status] - order[b.status]
    })
}

const TREND_STABLE_THRESHOLD = 5

export function buildDishTrendsPayload(trends: DishSalesTrend[]): DishTrendItem[] {
  return trends
    .filter(t => t.qtyRecent2Weeks > 0 || t.qtyPrev2Weeks > 0)
    .map(t => ({
      dishId: t.menuItemId,
      dishName: t.name,
      changePct: t.growthPct,
      direction: t.growthPct > TREND_STABLE_THRESHOLD
        ? 'up' as const
        : t.growthPct < -TREND_STABLE_THRESHOLD
          ? 'down' as const
          : 'stable' as const,
    }))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 10)
}

export function buildPredictiveInsights(input: {
  forecast: AffluenceForecastDay[]
  inventoryForecast: InventoryForecastItem[]
  dishTrends: DishTrendItem[]
}): PredictiveInsight[] {
  const insights: PredictiveInsight[] = []
  const { forecast, inventoryForecast, dishTrends } = input

  if (forecast.length > 0) {
    const peak = forecast.reduce(
      (best, day) => (day.predictedCovers > best.predictedCovers ? day : best),
      forecast[0]!,
    )
    insights.push({
      id: 'insight-peak-day',
      type: 'peak_day',
      titleKey: 'aiPredictive.insights.peakDay.title',
      bodyKey: 'aiPredictive.insights.peakDay.body',
      params: {
        dayKey: getDayI18nKey(peak.dayOfWeek),
        covers: peak.predictedCovers,
        confidence: peak.confidence,
      },
    })
  }

  const rainyDays = forecast.filter(d => d.weather === 'rain')
  if (rainyDays.length > 0) {
    const firstRain = rainyDays[0]!
    insights.push({
      id: 'insight-weather-rain',
      type: 'weather',
      titleKey: 'aiPredictive.insights.weather.title',
      bodyKey: 'aiPredictive.insights.weather.body',
      params: {
        dayKey: getDayI18nKey(firstRain.dayOfWeek),
        count: rainyDays.length,
      },
    })
  }

  const criticalItems = inventoryForecast.filter(i => i.status === 'critical' || i.status === 'low')
  if (criticalItems.length > 0) {
    const top = criticalItems[0]!
    insights.push({
      id: 'insight-inventory-risk',
      type: 'inventory',
      titleKey: 'aiPredictive.insights.inventory.title',
      bodyKey: 'aiPredictive.insights.inventory.body',
      params: {
        item: top.itemName,
        count: criticalItems.length,
        reorderQty: top.suggestedReorderQty,
        unit: top.unit,
      },
    })
  }

  const topTrend = dishTrends.find(t => t.direction === 'up')
  if (topTrend) {
    insights.push({
      id: `insight-trend-${topTrend.dishId}`,
      type: 'trend',
      titleKey: 'aiPredictive.insights.trend.title',
      bodyKey: 'aiPredictive.insights.trend.body',
      params: {
        dish: topTrend.dishName,
        pct: topTrend.changePct,
      },
    })
  }

  const totalCovers = forecast.reduce((sum, d) => sum + d.predictedCovers, 0)
  if (insights.length < 3 && totalCovers > 0) {
    insights.push({
      id: 'insight-week-total',
      type: 'peak_day',
      titleKey: 'aiPredictive.insights.weekTotal.title',
      bodyKey: 'aiPredictive.insights.weekTotal.body',
      params: { total: totalCovers },
    })
  }

  return insights.slice(0, 5)
}

export { resolveInventoryStatus }
