import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Brain, TrendingUp, AlertTriangle, Sparkles, CloudRain, Sun, Cloud,
  Package, RefreshCw,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { LuxuryChartFrame } from '../components/charts'
import { LuxuryLineChart } from '../components/charts/lazy'
import ChartSuspense from '../components/charts/ChartSuspense'
import { cn } from '../lib/utils'
import { usePredictiveAI, type PredictiveAlert, type AlertSeverity } from '../hooks/usePredictiveAI'
import { useTenantQueryKey } from '../contexts/AuthContext'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import PageSkeleton from '../components/ui/PageSkeleton'
import EmptyState from '../components/ui/EmptyState'
import AuraIcon from '../components/ui/AuraIcon'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

const SEVERITY_STYLES: Record<AlertSeverity, {
  card: string
  icon: typeof AlertTriangle
  iconColor: string
  badge: string
  badgeText: string
}> = {
  critical: {
    card: 'premium-card border border-rose-200 bg-white',
    icon: AlertTriangle,
    iconColor: 'text-rose-500',
    badge: 'bg-rose-50 border border-rose-100',
    badgeText: 'text-rose-700',
  },
  optimization: {
    card: 'premium-card border border-amber-200 bg-white',
    icon: CloudRain,
    iconColor: 'text-amber-600',
    badge: 'bg-amber-50 border border-amber-100',
    badgeText: 'text-amber-800',
  },
  opportunity: {
    card: 'premium-card border border-emerald-200 bg-white',
    icon: TrendingUp,
    iconColor: 'text-emerald-600',
    badge: 'bg-emerald-50 border border-emerald-100',
    badgeText: 'text-emerald-700',
  },
}

function WeatherIcon({ weather }: { weather: 'sunny' | 'cloudy' | 'rain' }) {
  if (weather === 'rain') return <AuraIcon icon={CloudRain} size="sm" className="text-blue-400" />
  if (weather === 'cloudy') return <AuraIcon icon={Cloud} size="sm" className="text-fumo" />
  return <AuraIcon icon={Sun} size="sm" className="text-aura-gold" />
}

function AlertCard({ alert }: { alert: PredictiveAlert }) {
  const { t } = useTranslation()
  const style = SEVERITY_STYLES[alert.severity]
  const Icon = style.icon

  const dayKey = alert.params.dayKey as string | undefined
  const params = {
    ...alert.params,
    ...(dayKey ? { day: t(dayKey) } : {}),
  }

  return (
    <article className={cn('rounded-xl p-4', style.card)}>
      <div className="flex gap-3">
        <div className={cn('mt-0.5 shrink-0 rounded-lg p-2', style.badge)}>
          <AuraIcon icon={Icon} size="lg" className={style.iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', style.badge, style.badgeText)}>
            {t(`aiPredictive.severity.${alert.severity}`)}
          </span>
          <p className="mt-2 text-sm font-medium leading-relaxed text-pietra">
            {t(alert.i18nKey, params)}
          </p>
        </div>
      </div>
    </article>
  )
}

function ChartSkeleton() {
  return <PageSkeleton variant="cards" count={1} className="p-4" />
}

function AlertsSkeleton() {
  return <PageSkeleton variant="list" count={3} className="p-4" />
}

export default function AIPredictivePage() {
  return <AIPredictivePageContent />
}

function AIPredictivePageContent() {
  const { t, i18n } = useTranslation()
  const tk = useTenantQueryKey()
  const { forecast, alerts, factorsUsed, engineVersion, generatedAt, weatherSource, isLoading, isFetching, isError, refetch } = usePredictiveAI()
  const toastedAlertsRef = useRef(new Set<string>())

  useEffect(() => {
    toastedAlertsRef.current.clear()
  }, [tk])

  useEffect(() => {
    if (isLoading || alerts.length === 0) return
    let count = 0
    for (const alert of alerts) {
      if (toastedAlertsRef.current.has(alert.id)) continue
      toastedAlertsRef.current.add(alert.id)
      const dayKey = alert.params.dayKey as string | undefined
      const msg = t(alert.i18nKey, {
        ...alert.params,
        ...(dayKey ? { day: t(dayKey) } : {}),
      })
      if (alert.severity === 'critical') toast.aiCritical(msg)
      else if (alert.severity === 'opportunity') toast.aiOpportunity(msg)
      else toast.ai(msg)
      count += 1
      if (count >= 2) break
    }
  }, [alerts, isLoading, t])

  const chartData = forecast.map(day => ({
    ...day,
    dayLabel: t(`aiPredictive.days.${DAY_KEYS[day.dayOfWeek]}`),
    shortDate: new Date(day.date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
  }))

  const factorLabels: Record<string, string> = {
    orderHistory: t('aiPredictive.factors.orderHistory'),
    dayOfWeek: t('aiPredictive.factors.dayOfWeek'),
    weather: t('aiPredictive.factors.weather'),
    reservations: t('aiPredictive.factors.reservations'),
  }

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('aiPredictive.title')}
        subtitle={t('aiPredictive.subtitle')}
        meta={(
          <>
            {engineVersion && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm">
                <AuraIcon icon={Brain} size="xs" className="text-aura-gold" />
                {t('aiPredictive.engineLabel', { version: engineVersion })}
                {weatherSource && (
                  <span className="text-fumo">
                    · {t(`aiPredictive.weatherSource.${weatherSource === 'open-meteo' ? 'openMeteo' : 'simulated'}`)}
                  </span>
                )}
              </span>
            )}
            {factorsUsed.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {factorsUsed.map(f => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm"
                  >
                    <AuraIcon icon={Sparkles} size="xs" className="text-aura-gold" />
                    {factorLabels[f]}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        actions={(
          <div className="flex items-center gap-2">
            {generatedAt && (
              <p className="text-xs text-fumo">
                {t('aiPredictive.updatedAt', {
                  date: new Date(generatedAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
                })}
              </p>
            )}
            <button
              type="button"
              disabled={isFetching}
              onClick={async () => {
                toastedAlertsRef.current.clear()
                const result = await refetch()
                if (result.isError) toast.error(t('aiPredictive.loadError'))
                else toast.success(t('aiPredictive.refreshed', { defaultValue: 'Dati aggiornati' }))
              }}
              className="inline-flex items-center gap-1.5 rounded-lg premium-card px-3 py-2 text-sm font-medium text-fumo shadow-sm transition-colors hover:bg-white/[0.05] disabled:opacity-60"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              {t('aiPredictive.refresh')}
            </button>
          </div>
        )}
      />

      {isError && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-400">{t('aiPredictive.loadError')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <LuxuryChartFrame
          className="xl:col-span-3"
          title={t('aiPredictive.chartTitle')}
          subtitle={t('aiPredictive.chartSubtitle')}
          hero
        >
          {isLoading ? (
            <ChartSkeleton />
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
          ) : (
            <>
              <ChartSuspense height={320}>
                <LuxuryLineChart
                  data={chartData}
                  xKey="dayLabel"
                  height={320}
                  yAxisInteger
                  showLegend
                  labelFormatter={(_, row) => {
                    const r = row as { dayLabel: string; shortDate: string } | undefined
                    return r ? `${r.dayLabel} · ${r.shortDate}` : ''
                  }}
                  series={[
                    {
                      dataKey: 'baseCovers',
                      label: t('aiPredictive.chartHistorical'),
                      accent: 'champagne',
                      dashed: true,
                      dot: false,
                    },
                    {
                      dataKey: 'predictedCovers',
                      label: t('aiPredictive.chartPredicted'),
                      accent: 'gold',
                    },
                  ]}
                />
              </ChartSuspense>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {chartData.map(day => (
                  <div
                    key={day.date}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-2 text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <WeatherIcon weather={day.weather} />
                      <span className="text-xs font-medium text-pietra">{day.dayLabel.slice(0, 3)}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-aura-gold-light">{day.predictedCovers}</p>
                    {day.weatherImpactPct !== 0 && (
                      <p className="text-[10px] text-fumo">{day.weatherImpactPct}%</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </LuxuryChartFrame>

        <section className="aura-module-frame xl:col-span-2">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-semibold text-pietra">{t('aiPredictive.alertsTitle')}</h2>
            </div>
            <p className="mt-1 text-sm text-fumo">{t('aiPredictive.alertsSubtitle')}</p>
          </div>

          {isLoading ? (
            <AlertsSkeleton />
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={t('aiPredictive.noAlerts')}
              description={t('aiPredictive.noAlertsHint')}
            />
          ) : (
            <div className="space-y-3 p-4">
              {alerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </section>
      </div>
    </ExecutivePageShell>
  )
}
