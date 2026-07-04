import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'unknown'
export type AlertSeverity = 'critical' | 'optimization' | 'opportunity'

export interface InventoryItemPredictive {
  id: string
  name: string
  currentQuantity: number
  minimumThreshold: number
  unit: string
}

export interface AffluenceForecastDay {
  date: string
  dayOfWeek: number
  dayLabel?: string
  predictedCovers: number
  baseCovers: number
  weather: WeatherCondition
  weatherImpactPct: number
  confidence: number
  historicalSamples: number
  reservedCovers?: number
  walkInCovers?: number
}

export interface PredictiveAlert {
  id: string
  severity: AlertSeverity
  i18nKey: string
  params: Record<string, string | number>
}

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

export interface PredictiveAIData {
  forecast: AffluenceForecastDay[]
  alerts: PredictiveAlert[]
  factorsUsed: ('orderHistory' | 'dayOfWeek' | 'weather' | 'reservations')[]
  engineVersion?: string
  generatedAt: string
  weatherSource?: 'open-meteo' | 'simulated'
  inventoryForecast: InventoryForecastItem[]
  dishTrends: DishTrendItem[]
  insights: PredictiveInsight[]
  hasRecipeLinks: boolean
}

/**
 * Hook predittivo: incrocia storico ordini, giorno settimana e meteo simulato.
 * Chiama GET /api/ai/predictive — errori propagati al consumer.
 */
export function usePredictiveAI() {
  const tk = useTenantQueryKey()
  const query = useQuery<PredictiveAIData>({
    queryKey: tq(tk, 'ai', 'predictive'),
    queryFn: () => api.get<PredictiveAIData>('/ai/predictive').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  return {
    forecast: query.data?.forecast ?? [],
    alerts: query.data?.alerts ?? [],
    factorsUsed: query.data?.factorsUsed ?? [],
    engineVersion: query.data?.engineVersion,
    generatedAt: query.data?.generatedAt,
    weatherSource: query.data?.weatherSource,
    inventoryForecast: query.data?.inventoryForecast ?? [],
    dishTrends: query.data?.dishTrends ?? [],
    insights: query.data?.insights ?? [],
    hasRecipeLinks: query.data?.hasRecipeLinks ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  }
}

/** Normalizza InventoryItem Prisma → dominio predittivo */
export function mapInventoryItem(item: {
  id: string
  name: string
  quantity: number
  minQuantity: number
  unit: string
}): InventoryItemPredictive {
  return {
    id: item.id,
    name: item.name,
    currentQuantity: item.quantity,
    minimumThreshold: item.minQuantity,
    unit: item.unit,
  }
}
