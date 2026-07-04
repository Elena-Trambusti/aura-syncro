import type { AffluenceForecastDay, PredictiveAlert } from '../../hooks/usePredictiveAI'

export const DAY_KEYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const

export type DayKey = (typeof DAY_KEYS)[number]

export interface ChartDayRow extends AffluenceForecastDay {
  dayLabel: string
  shortDate: string
  deltaVsBase: number
}

export interface PredictiveKpiMetrics {
  totalCovers: number
  peakDay: AffluenceForecastDay | null
  avgConfidence: number
  alertCount: number
  criticalCount: number
  opportunityCount: number
}

export function computePredictiveKpis(
  forecast: AffluenceForecastDay[],
  alerts: PredictiveAlert[],
): PredictiveKpiMetrics {
  const totalCovers = forecast.reduce((sum, day) => sum + day.predictedCovers, 0)
  const peakDay = forecast.length > 0
    ? forecast.reduce((best, day) => (day.predictedCovers > best.predictedCovers ? day : best), forecast[0]!)
    : null
  const avgConfidence = forecast.length > 0
    ? Math.round(forecast.reduce((sum, day) => sum + day.confidence, 0) / forecast.length)
    : 0

  return {
    totalCovers,
    peakDay,
    avgConfidence,
    alertCount: alerts.length,
    criticalCount: alerts.filter(a => a.severity === 'critical').length,
    opportunityCount: alerts.filter(a => a.severity === 'opportunity').length,
  }
}

export function buildChartRows(
  forecast: AffluenceForecastDay[],
  dayLabel: (dow: number) => string,
  shortDate: (date: string) => string,
): ChartDayRow[] {
  return forecast.map(day => ({
    ...day,
    dayLabel: dayLabel(day.dayOfWeek),
    shortDate: shortDate(day.date),
    deltaVsBase: day.baseCovers > 0
      ? Math.round(((day.predictedCovers - day.baseCovers) / day.baseCovers) * 100)
      : 0,
  }))
}
