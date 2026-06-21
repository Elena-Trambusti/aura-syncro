import { useTranslation } from 'react-i18next'
import {
  Brain, TrendingUp, AlertTriangle, Sparkles, CloudRain, Sun, Cloud,
  Package, RefreshCw,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '../lib/utils'
import { usePredictiveAI, type PredictiveAlert, type AlertSeverity } from '../hooks/usePredictiveAI'

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
    bg: 'bg-white',
    icon: AlertTriangle,
    iconColor: 'text-rose-500',
    badge: 'bg-rose-50',
    badgeText: 'text-rose-700',
  },
  optimization: {
    border: 'border-amber-200',
    bg: 'bg-white',
    icon: CloudRain,
    iconColor: 'text-amber-500',
    badge: 'bg-amber-50',
    badgeText: 'text-amber-700',
  },
  opportunity: {
    border: 'border-emerald-200',
    bg: 'bg-white',
    icon: TrendingUp,
    iconColor: 'text-emerald-500',
    badge: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
  },
}

function WeatherIcon({ weather }: { weather: 'sunny' | 'cloudy' | 'rain' }) {
  if (weather === 'rain') return <CloudRain className="h-3.5 w-3.5 text-blue-500" />
  if (weather === 'cloudy') return <Cloud className="h-3.5 w-3.5 text-slate-400" />
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
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-900">
            {t(alert.i18nKey, params)}
          </p>
        </div>
      </div>
    </article>
  )
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  )
}

function AlertsSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-1/4 rounded bg-slate-200 mb-3" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-2/3 rounded bg-slate-100 mt-2" />
        </div>
      ))}
    </div>
  )
}

export default function AIPredictivePage() {
  return <AIPredictivePageContent />
}

function AIPredictivePageContent() {
  const { t, i18n } = useTranslation()
  const { forecast, alerts, factorsUsed, engineVersion, generatedAt, isLoading, refetch } = usePredictiveAI()

  const chartData = forecast.map(day => ({
    ...day,
    dayLabel: t(`aiPredictive.days.${DAY_KEYS[day.dayOfWeek]}`),
    shortDate: new Date(day.date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
  }))

  const factorLabels: Record<string, string> = {
    orderHistory: t('aiPredictive.factors.orderHistory'),
    dayOfWeek: t('aiPredictive.factors.dayOfWeek'),
    weather: t('aiPredictive.factors.weather'),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 shadow-sm">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="aura-page-title text-slate-900">{t('aiPredictive.title')}</h1>
              <p className="aura-page-subtitle">{t('aiPredictive.subtitle')}</p>
            </div>
          </div>
          {engineVersion && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
              <Brain className="h-3 w-3 text-amber-500" />
              {t('aiPredictive.engineLabel', { version: engineVersion })}
            </span>
          )}
          {factorsUsed.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {factorsUsed.map(f => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
                >
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  {factorLabels[f]}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <p className="text-xs text-slate-500">
              {t('aiPredictive.updatedAt', {
                date: new Date(generatedAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }),
              })}
            </p>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            {t('aiPredictive.refresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="xl:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900">{t('aiPredictive.chartTitle')}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{t('aiPredictive.chartSubtitle')}</p>
          </div>

          {isLoading ? (
            <ChartSkeleton />
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
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <WeatherIcon weather={day.weather} />
                      <span className="text-xs font-medium text-slate-900">{day.dayLabel.slice(0, 3)}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{day.predictedCovers}</p>
                    {day.weatherImpactPct !== 0 && (
                      <p className="text-[10px] text-slate-500">{day.weatherImpactPct}%</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900">{t('aiPredictive.alertsTitle')}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{t('aiPredictive.alertsSubtitle')}</p>
          </div>

          {isLoading ? (
            <AlertsSkeleton />
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-medium text-slate-900">{t('aiPredictive.noAlerts')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('aiPredictive.noAlertsHint')}</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {alerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
