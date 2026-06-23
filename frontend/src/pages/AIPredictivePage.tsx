import { useTranslation } from 'react-i18next'
import {
  Brain, TrendingUp, AlertTriangle, Sparkles, CloudRain, Sun, Cloud,
  Package, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '../lib/utils'
import { usePredictiveAI, type PredictiveAlert, type AlertSeverity } from '../hooks/usePredictiveAI'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import PageSkeleton from '../components/ui/PageSkeleton'
import EmptyState from '../components/ui/EmptyState'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

const SEVERITY_STYLES: Record<AlertSeverity, {
  border: string
  bg: string
  icon: typeof AlertTriangle
  iconColor: string
  badge: string
  badgeText: string
}> = {
  critical: {
    border: 'border-rose-200',
    bg: 'bg-navy-elevated',
    icon: AlertTriangle,
    iconColor: 'text-rose-500',
    badge: 'bg-rose-50',
    badgeText: 'text-rose-700',
  },
  optimization: {
    border: 'border-aura-gold/25',
    bg: 'bg-navy-elevated',
    icon: CloudRain,
    iconColor: 'text-amber-500',
    badge: 'bg-aura-gold/10',
    badgeText: 'text-aura-gold',
  },
  opportunity: {
    border: 'border-emerald-500/25',
    bg: 'bg-navy-elevated',
    icon: TrendingUp,
    iconColor: 'text-emerald-500',
    badge: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
  },
}

function WeatherIcon({ weather }: { weather: 'sunny' | 'cloudy' | 'rain' }) {
  if (weather === 'rain') return <CloudRain className="h-3.5 w-3.5 text-blue-500" />
  if (weather === 'cloudy') return <Cloud className="h-3.5 w-3.5 text-fumo" />
  return <Sun className="h-3.5 w-3.5 text-amber-500" />
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
    <article className={cn('rounded-xl border shadow-sm p-4', style.border, style.bg)}>
      <div className="flex gap-3">
        <div className={cn('mt-0.5 shrink-0 rounded-lg p-2', style.badge)}>
          <Icon className={cn('h-5 w-5', style.iconColor)} />
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
  const { forecast, alerts, factorsUsed, engineVersion, generatedAt, weatherSource, isLoading, isFetching, isError, refetch } = usePredictiveAI()

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
              <span className="inline-flex items-center gap-1.5 rounded-lg premium-card px-2.5 py-1 text-xs font-medium text-fumo shadow-sm">
                <Brain className="h-3 w-3 text-amber-500" />
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
                    className="inline-flex items-center gap-1.5 rounded-lg premium-card px-2.5 py-1 text-xs font-medium text-fumo shadow-sm"
                  >
                    <Sparkles className="h-3 w-3 text-amber-500" />
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
        <section className="xl:col-span-3 rounded-xl premium-card shadow-sm">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-semibold text-pietra">{t('aiPredictive.chartTitle')}</h2>
            </div>
            <p className="mt-1 text-sm text-fumo">{t('aiPredictive.chartSubtitle')}</p>
          </div>

          {isLoading ? (
            <ChartSkeleton />
          ) : isError ? (
            <div className="p-8 text-center text-sm text-red-400">{t('aiPredictive.loadError')}</div>
          ) : (
            <div className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="dayLabel"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      backgroundColor: '#fff',
                    }}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload
                      return row ? `${row.dayLabel} · ${row.shortDate}` : ''
                    }}
                    formatter={(value, name) => {
                      const label = name === 'predictedCovers'
                        ? t('aiPredictive.chartPredicted')
                        : t('aiPredictive.chartHistorical')
                      return [value, label]
                    }}
                  />
                  <Legend
                    formatter={value =>
                      value === 'predictedCovers'
                        ? t('aiPredictive.chartPredicted')
                        : t('aiPredictive.chartHistorical')
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="baseCovers"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="baseCovers"
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedCovers"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                    name="predictedCovers"
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {chartData.map(day => (
                  <div
                    key={day.date}
                    className="rounded-lg border border-white/[0.08] bg-navy-surface/50 px-2 py-2 text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <WeatherIcon weather={day.weather} />
                      <span className="text-xs font-medium text-pietra">{day.dayLabel.slice(0, 3)}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-pietra">{day.predictedCovers}</p>
                    {day.weatherImpactPct !== 0 && (
                      <p className="text-[10px] text-fumo">{day.weatherImpactPct}%</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="xl:col-span-2 rounded-xl premium-card shadow-sm">
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
