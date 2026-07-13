import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, formatLongDate, getIntlLocale } from '../lib/utils'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { usePlanTier } from '../hooks/usePlanTier'
import { useRole } from '../hooks/useRole'
import { tq } from '../lib/queryKeys'
import {
  TrendingUp, ShoppingBag, CalendarCheck,
  Users, AlertTriangle, ClipboardList, AlertCircle,
  UtensilsCrossed, Clock,
} from 'lucide-react'
import KpiCard from '../components/ui/KpiCard'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import OperationalPulse from '../components/dashboard/OperationalPulse'
import ServiceHeatmap from '../components/dashboard/ServiceHeatmap'
import LiveCommandCenter from '../components/dashboard/LiveCommandCenter'
import PageSkeleton from '../components/ui/PageSkeleton'
import { useShowQuerySkeleton } from '../hooks/useShowQuerySkeleton'
import { LuxuryAreaChart } from '../components/charts/lazy'
import ChartSuspense from '../components/charts/ChartSuspense'

interface DashboardData {
  today: { orders: number; revenue: number; reservations: number; activeOrders: number }
  month: { revenue: number; revenueGrowth: number }
  totals: { customers: number; lowStockAlerts: number; avgTurnoverMinutes: number }
}

function ChartError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-fumo">
      <AlertCircle className="mb-2 h-8 w-8 text-red-400" />
      <p className="text-sm text-red-400">{message}</p>
    </div>
  )
}

function ChartLoading({ height = 280 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl bg-white/[0.04]"
      style={{ height }}
      aria-hidden
    />
  )
}

function TopDishRow({
  rank,
  name,
  quantity,
  maxQuantity,
  piecesLabel,
}: {
  rank: number
  name: string
  quantity: number
  maxQuantity: number
  piecesLabel: string
}) {
  const [animated, setAnimated] = useState(false)
  const pct = Math.min(100, (quantity / maxQuantity) * 100)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="group -mx-1 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-[11px] font-bold tabular-nums text-fumo transition-colors group-hover:border-aura-gold/30 group-hover:text-aura-gold">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-pietra">{name}</p>
        <div className="premium-progress-track mt-1.5">
          <div
            className="premium-progress-bar"
            style={{
              width: animated ? `${pct}%` : '0%',
              transitionDelay: `${rank * 80}ms`,
            }}
          />
        </div>
      </div>
      <span className="text-xs font-semibold tabular-nums text-fumo transition-colors group-hover:text-pietra">
        {quantity} {piecesLabel}
      </span>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const tk = useTenantQueryKey()
  const { hasProPlan } = usePlanTier()
  const { can } = useRole()
  const canAnalytics = can('analytics.read')
  const locale = getIntlLocale()

  const tenantReady = Boolean(restaurant?.id)

  const { data: dashboard, isError: summaryError, isLoading: summaryLoading } = useQuery<DashboardData>({
    queryKey: tq(tk, 'analytics', 'summary'),
    queryFn: () => api.get('/analytics/summary').then(r => r.data),
    refetchInterval: 30_000,
    enabled: tenantReady && canAnalytics,
  })
  const showSummarySkeleton = useShowQuerySkeleton(summaryLoading, dashboard != null)

  const { data: revenueData, isError: revenueError, isLoading: revenueLoading } = useQuery({
    queryKey: tq(tk, 'analytics', 'revenue', '7d'),
    queryFn: () => api.get('/analytics/revenue?period=7d').then(r => r.data),
    enabled: tenantReady && hasProPlan && canAnalytics,
  })
  const showRevenueSkeleton = useShowQuerySkeleton(revenueLoading, revenueData != null)

  const { data: topItems, isError: topItemsError, isLoading: topItemsLoading } = useQuery({
    queryKey: tq(tk, 'analytics', 'top-items'),
    queryFn: () => api.get('/analytics/top-items').then(r => r.data),
    enabled: tenantReady && hasProPlan && canAnalytics,
  })
  const showTopItemsSkeleton = useShowQuerySkeleton(topItemsLoading, topItems != null)

  const { data: hourlyData, isError: hourlyError, isLoading: hourlyLoading } = useQuery({
    queryKey: tq(tk, 'analytics', 'hourly'),
    queryFn: () => api.get('/analytics/hourly').then(r => r.data),
    enabled: tenantReady && hasProPlan && canAnalytics,
  })
  const showHourlySkeleton = useShowQuerySkeleton(hourlyLoading, hourlyData != null)

  const revenueSparkline = useMemo(
    () => (revenueData as Array<{ revenue?: number }> | undefined)?.map(d => d.revenue ?? 0) ?? [],
    [revenueData],
  )

  const opsItems = useMemo(() => [
    {
      key: 'service',
      label: t('dashboard.opsService', { defaultValue: 'Servizio' }),
      value: (dashboard?.today.activeOrders || 0) > 0
        ? t('dashboard.opsServiceLive', { defaultValue: 'In corso' })
        : t('dashboard.opsServiceIdle', { defaultValue: 'Pronto' }),
      hint: t('dashboard.activeOrdersSub'),
      icon: UtensilsCrossed,
      tone: 'gold' as const,
      live: (dashboard?.today.activeOrders || 0) > 0,
    },
    {
      key: 'orders',
      label: t('dashboard.opsOrders', { defaultValue: 'Ordini oggi' }),
      value: String(dashboard?.today.orders || 0),
      hint: t('dashboard.todayOrdersSub'),
      icon: ClipboardList,
      tone: 'blue' as const,
    },
    {
      key: 'covers',
      label: t('dashboard.opsCovers', { defaultValue: 'Coperti' }),
      value: String(dashboard?.today.reservations || 0),
      hint: t('dashboard.todayReservationsSub'),
      icon: CalendarCheck,
      tone: 'emerald' as const,
    },
    {
      key: 'alerts',
      label: t('dashboard.opsAlerts', { defaultValue: 'Allerte' }),
      value: String(dashboard?.totals.lowStockAlerts || 0),
      hint: t('dashboard.stockAlertsSub'),
      icon: AlertTriangle,
      tone: (dashboard?.totals.lowStockAlerts || 0) > 0 ? 'rose' as const : 'amber' as const,
    },
  ], [t, dashboard])

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('dashboard.title', { name: restaurant?.name || t('common.restaurant') })}
        actions={(
          <div className="flex flex-col items-end gap-2">
            <div className="aura-date-badge">
              <Clock className="mr-1.5 h-3.5 w-3.5 text-aura-gold/80" aria-hidden />
              {formatLongDate()}
            </div>
            {hasProPlan && (
              <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-fumo/70">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aura-gold/50 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-aura-gold/80"></span>
                </span>
                {t('dashboard.liveSync', { defaultValue: 'Sync live · 30s' })}
              </span>
            )}
          </div>
        )}
      />

      {showSummarySkeleton ? (
        <PageSkeleton variant="cards" count={4} />
      ) : (
        <>
      {canAnalytics && summaryError && (
        <div className="premium-alert-error">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{t('common.loadError')}</p>
        </div>
      )}

      {canAnalytics && (
      <section aria-label={t('dashboard.kpiSection', { defaultValue: 'Indicatori chiave' })}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-4 w-full">
          <KpiCard
            title={t('dashboard.todayRevenue')}
            value={formatCurrency(dashboard?.today.revenue || 0)}
            subtitle={t('dashboard.todayRevenueSub')}
            icon={TrendingUp}
            accent="gold"
            size="hero"
            valueTone="gold"
            sparklineData={revenueSparkline.length >= 2 ? revenueSparkline : undefined}
          />
          <KpiCard
            title={t('dashboard.monthlyRevenue')}
            value={formatCurrency(dashboard?.month.revenue || 0)}
            icon={ShoppingBag}
            trend={dashboard?.month.revenueGrowth}
            trendLabel={v => t('dashboard.vsLastMonth', { value: v })}
            accent="gold"
            size="hero"
            valueTone="gold"
          />
          <KpiCard
            title={t('dashboard.activeOrders')}
            value={String(dashboard?.today.activeOrders || 0)}
            subtitle={t('dashboard.activeOrdersSub')}
            icon={ClipboardList}
            accent="gold"
            size="hero"
            valueTone="gold"
          />
          <KpiCard
            title={t('dashboard.todayReservations')}
            value={String(dashboard?.today.reservations || 0)}
            subtitle={t('dashboard.todayReservationsSub')}
            icon={CalendarCheck}
            accent="gold"
            size="hero"
            valueTone="gold"
          />
        </div>
      </section>
      )}

      <LiveCommandCenter />

      {canAnalytics && (
      <section aria-label={t('dashboard.operationalStatus', { defaultValue: 'Stato operativo' })}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="aura-section-eyebrow">
            {t('dashboard.operationalStatus', { defaultValue: 'Stato operativo' })}
          </h2>
        </div>
        <OperationalPulse items={opsItems} />
      </section>
      )}

      {canAnalytics && (
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" aria-label={t('dashboard.secondaryMetrics', { defaultValue: 'Metriche secondarie' })}>
        <KpiCard
          title={t('dashboard.totalCustomers')}
          value={String(dashboard?.totals.customers || 0)}
          subtitle={t('dashboard.totalCustomersSub')}
          icon={Users}
          accent="emerald"
          size="compact"
        />
        <KpiCard
          title={t('dashboard.stockAlerts')}
          value={String(dashboard?.totals.lowStockAlerts || 0)}
          subtitle={t('dashboard.stockAlertsSub')}
          icon={AlertTriangle}
          accent="amber"
          size="compact"
        />
        <KpiCard
          title={t('dashboard.avgTurnover', { defaultValue: 'Rotazione Media' })}
          value={`${dashboard?.totals?.avgTurnoverMinutes || 0} min`}
          subtitle={t('dashboard.avgTurnoverSub', { defaultValue: 'Tempo occupazione tavolo' })}
          icon={Clock}
          accent="blue"
          size="compact"
          className="col-span-2 lg:col-span-1"
        />
      </section>
      )}

      {hasProPlan && canAnalytics && (
        <section className="aura-dashboard-bento" aria-label={t('dashboard.analyticsSection', { defaultValue: 'Analytics' })}>
          <div className="aura-module-frame aura-module-frame--hero aura-bento-span-8 p-5 sm:p-6 lg:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="aura-brand-eyebrow">{t('dashboard.performance', { defaultValue: 'Performance' })}</p>
                <h3 className="premium-section-title mt-1">{t('dashboard.revenueChart')}</h3>
              </div>
              <p className="text-[11px] text-fumo/70">{t('dashboard.revenueLabel', { defaultValue: 'Fatturato netto' })}</p>
            </div>
            {revenueError ? (
              <ChartError message={t('common.loadError')} />
            ) : showRevenueSkeleton ? (
              <ChartLoading height={280} />
            ) : (
              <ChartSuspense height={280}>
                <LuxuryAreaChart
                  data={(revenueData as Array<{ date: string; revenue: number }>) || []}
                  dataKey="revenue"
                  xKey="date"
                  locale={locale}
                  valueLabel={t('dashboard.revenueLabel', { defaultValue: 'Fatturato netto' })}
                  height={280}
                />
              </ChartSuspense>
            )}
          </div>

          <div className="aura-bento-span-4 space-y-4 sm:space-y-5">
            <div className="aura-module-frame p-5 sm:p-6">
              <p className="aura-brand-eyebrow">{t('dashboard.peakHours', { defaultValue: 'Heatmap servizio' })}</p>
              <h3 className="premium-section-title mt-1 mb-4">
                {t('dashboard.serviceHeatmap', { defaultValue: 'Intensità oraria' })}
              </h3>
              {hourlyError ? (
                <ChartError message={t('common.loadError')} />
              ) : showHourlySkeleton ? (
                <ChartLoading height={160} />
              ) : (
                <ServiceHeatmap
                  data={hourlyData || []}
                  locale={locale}
                  peakLabel={t('dashboard.peakHour', { defaultValue: 'Ora di punta' })}
                  quietLabel={t('dashboard.last7Days', { defaultValue: 'Ultimi 7 giorni' })}
                />
              )}
            </div>

            <div className="aura-module-frame p-5 sm:p-6">
              <p className="aura-brand-eyebrow">{t('dashboard.menuPerformance', { defaultValue: 'Menu' })}</p>
              <h3 className="premium-section-title mt-1 mb-3">{t('dashboard.topDishes')}</h3>
              {topItemsError ? (
                <ChartError message={t('common.loadError')} />
              ) : showTopItemsSkeleton ? (
                <PageSkeleton variant="list" count={5} />
              ) : (
                <div className="space-y-0.5">
                  {(topItems || []).slice(0, 5).map((item: { menuItemId: string; name: string; quantity: number }, idx: number) => (
                    <TopDishRow
                      key={item.menuItemId}
                      rank={idx + 1}
                      name={item.name}
                      quantity={item.quantity}
                      maxQuantity={topItems?.[0]?.quantity || 1}
                      piecesLabel={t('common.pieces')}
                    />
                  ))}
                  {(!topItems || topItems.length === 0) && (
                    <p className="py-6 text-center text-sm text-fumo">{t('common.noData')}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
        </>
      )}
    </ExecutivePageShell>
  )
}
