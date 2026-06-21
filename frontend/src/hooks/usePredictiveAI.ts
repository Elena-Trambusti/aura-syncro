import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

export type WeatherCondition = 'sunny' | 'cloudy' | 'rain'
export type AlertSeverity = 'critical' | 'optimization' | 'opportunity'

/** Mappa i campi Prisma `quantity` / `minQuantity` ai nomi del dominio predittivo */
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
}

export interface PredictiveAlert {
  id: string
  severity: AlertSeverity
  i18nKey: string
  params: Record<string, string | number>
}

export interface PredictiveAIData {
  forecast: AffluenceForecastDay[]
  alerts: PredictiveAlert[]
  factorsUsed: ('orderHistory' | 'dayOfWeek' | 'weather')[]
  engineVersion?: string
  generatedAt: string
}

/** Fallback client-side quando l'API non è disponibile */
function buildMockPredictiveData(): PredictiveAIData {
  const today = new Date()
  const forecast: AffluenceForecastDay[] = []
  const weathers: WeatherCondition[] = ['sunny', 'sunny', 'cloudy', 'rain', 'sunny', 'sunny', 'rain']
  const baseByDow = [55, 48, 52, 58, 72, 95, 150]

  for (let i = 1; i <= 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dow = date.getDay()
    const weather = weathers[i - 1]
    const mult = weather === 'rain' ? 0.75 : weather === 'cloudy' ? 0.92 : 1
    const base = baseByDow[dow]
    forecast.push({
      date: date.toISOString().split('T')[0],
      dayOfWeek: dow,
      baseCovers: base,
      predictedCovers: Math.round(base * mult),
      weather,
      weatherImpactPct: Math.round((mult - 1) * 100),
      confidence: 72,
      historicalSamples: 8,
    })
  }

  return {
    forecast,
    alerts: [
      {
        id: 'mock-stock',
        severity: 'critical',
        i18nKey: 'aiPredictive.alerts.stockCritical',
        params: {
          covers: 150,
          dayKey: 'aiPredictive.days.saturday',
          item: 'Farina',
          qty: 10,
          unit: 'kg',
          orderQty: 20,
        },
      },
      {
        id: 'mock-rain',
        severity: 'optimization',
        i18nKey: 'aiPredictive.alerts.rainFish',
        params: { dayKey: 'aiPredictive.days.sunday', pct: 25, item: 'Pesce fresco' },
      },
      {
        id: 'mock-trend',
        severity: 'opportunity',
        i18nKey: 'aiPredictive.alerts.trendDish',
        params: { dish: 'Tiramisù della Casa', pct: 40 },
      },
    ],
    factorsUsed: ['orderHistory', 'dayOfWeek', 'weather'],
    engineVersion: 'statistical_rules_v1',
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Hook predittivo: incrocia storico ordini, giorno settimana e meteo simulato.
 * Chiama GET /api/ai/predictive con fallback mock locale.
 */
export function usePredictiveAI() {
  const tk = useTenantQueryKey()
  const query = useQuery<PredictiveAIData>({
    queryKey: tq(tk, 'ai', 'predictive'),
    queryFn: async () => {
      try {
        const { data } = await api.get<PredictiveAIData>('/ai/predictive')
        return data
      } catch {
        return buildMockPredictiveData()
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  return {
    forecast: query.data?.forecast ?? [],
    alerts: query.data?.alerts ?? [],
    factorsUsed: query.data?.factorsUsed ?? [],
    engineVersion: query.data?.engineVersion,
    generatedAt: query.data?.generatedAt,
    isLoading: query.isLoading,
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
