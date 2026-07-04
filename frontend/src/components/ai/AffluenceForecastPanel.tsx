import { Cloud, CloudRain, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LuxuryChartFrame } from '../charts'
import ChartSuspense from '../charts/ChartSuspense'
import PageSkeleton from '../ui/PageSkeleton'
import AuraIcon from '../ui/AuraIcon'
import { cn } from '../../lib/utils'
import type { ChartDayRow } from './types'
import PredictiveAffluenceChart from './PredictiveAffluenceChart'

function WeatherIcon({ weather }: { weather: 'sunny' | 'cloudy' | 'rain' | 'unknown' }) {
  if (weather === 'rain') return <AuraIcon icon={CloudRain} size="sm" className="text-blue-400" />
  if (weather === 'cloudy') return <AuraIcon icon={Cloud} size="sm" className="text-fumo" />
  return <AuraIcon icon={Sun} size="sm" className="text-aura-gold" />
}

interface AffluenceForecastPanelProps {
  chartData: ChartDayRow[]
  isLoading: boolean
  isError: boolean
  className?: string
}

export default function AffluenceForecastPanel({
  chartData,
  isLoading,
  isError,
  className,
}: AffluenceForecastPanelProps) {
  const { t } = useTranslation()
  const hasReservationData = chartData.some(
    day => (day.reservedCovers ?? 0) > 0 || (day.walkInCovers ?? 0) > 0,
  )

  return (
    <LuxuryChartFrame
      className={className}
      title={t('aiPredictive.chartTitle')}
      subtitle={t('aiPredictive.chartSubtitle')}
      hero
    >
      {isLoading ? (
        <PageSkeleton variant="cards" count={1} className="p-4" />
      ) : isError ? (
        <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
      ) : (
        <>
          <ChartSuspense height={320}>
            <PredictiveAffluenceChart
              data={chartData}
              height={320}
              hasReservationData={hasReservationData}
            />
          </ChartSuspense>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {chartData.map(day => (
              <div
                key={day.date}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-2.5 py-2.5 text-center transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-center gap-1">
                  <WeatherIcon weather={day.weather} />
                  <span className="text-xs font-medium text-pietra">{day.dayLabel.slice(0, 3)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums text-aura-gold-light">
                  {day.predictedCovers}
                </p>
                {day.deltaVsBase !== 0 && (
                  <p className={cn(
                    'text-[10px] tabular-nums',
                    day.deltaVsBase > 0 ? 'text-emerald-400/90' : 'text-fumo',
                  )}
                  >
                    {day.deltaVsBase > 0 ? '+' : ''}{day.deltaVsBase}%
                  </p>
                )}
                {day.confidence > 0 && (
                  <p className="text-[10px] text-fumo/70">
                    {t('aiPredictive.confidenceLabel')}: {day.confidence}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </LuxuryChartFrame>
  )
}
