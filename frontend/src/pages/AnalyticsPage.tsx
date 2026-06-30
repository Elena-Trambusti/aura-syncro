
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { downloadCSV } from '../lib/export'
import { ui } from '../lib/ui'
import KpiCard from '../components/ui/KpiCard'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import PageSkeleton from '../components/ui/PageSkeleton'
import { useShowQuerySkeleton } from '../hooks/useShowQuerySkeleton'
import FilterPills from '../components/ui/FilterPills'
import { Download, AlertCircle, TrendingUp, ShoppingBag, Receipt } from 'lucide-react'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { LuxuryChartFrame } from '../components/charts'
import { LuxuryAreaChart, LuxuryBarChart } from '../components/charts/lazy'
import ChartSuspense from '../components/charts/ChartSuspense'

type Period = '7d' | '30d' | '90d'

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation()
  const tk = useTenantQueryKey()
  const [period, setPeriod] = useState<Period>('30d')
  const locale = i18n.language

  const { data: revenue, isLoading: revenueLoading, isError: revenueError } = useQuery({
    queryKey: tq(tk, 'analytics', 'revenue', period),
    queryFn: () => api.get(`/analytics/revenue?period=${period}`).then(r => r.data),
  })

  const { data: topItems, isLoading: topItemsLoading, isError: topItemsError } = useQuery({
    queryKey: tq(tk, 'analytics', 'top-items'),
    queryFn: () => api.get('/analytics/top-items').then(r => r.data),
  })

  const { data: hourly, isLoading: hourlyLoading, isError: hourlyError } = useQuery({
    queryKey: tq(tk, 'analytics', 'hourly'),
    queryFn: () => api.get('/analytics/hourly').then(r => r.data),
  })

  const isLoading = revenueLoading || topItemsLoading || hourlyLoading
  const hasData = revenue !== undefined || topItems !== undefined || hourly !== undefined
  const showAnalyticsSkeleton = useShowQuerySkeleton(isLoading, hasData)
  const hasError = revenueError || topItemsError || hourlyError

  const totalRevenue = (revenue || []).reduce((s: number, d: { revenue: number }) => s + d.revenue, 0)
  const totalOrders = (revenue || []).reduce((s: number, d: { orders: number }) => s + d.orders, 0)
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const pieData = (topItems || []).slice(0, 6).map((item: { name: string; quantity: number; revenue: number }) => ({
    name: item.name.length > 20 ? item.name.slice(0, 20) + '…' : item.name,
    value: item.revenue,
  }))

  const peakHours = (hourly || [])
    .filter((h: { orders: number }) => h.orders > 0)
    .sort((a: { orders: number }, b: { orders: number }) => b.orders - a.orders)
    .slice(0, 3)

  const periodLabels: Record<Period, string> = {
    '7d': t('analytics.period7d', { defaultValue: '7 giorni' }),
    '30d': t('analytics.period30d', { defaultValue: '30 giorni' }),
    '90d': t('analytics.period90d', { defaultValue: '90 giorni' }),
  }

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
        actions={(
          <button
            type="button"
            disabled={!revenue?.length}
            onClick={() => {
              if (!revenue) return
              downloadCSV(
                `fatturato-${period}-${new Date().toISOString().split('T')[0]}.csv`,
                [t('analytics.csvDate'), t('analytics.csvRevenue'), t('analytics.csvOrders')],
                revenue.map((r: { date: string; revenue: number; orders: number }) => [
                  new Date(r.date).toLocaleDateString(locale),
                  r.revenue.toFixed(2),
                  r.orders,
                ]),
              )
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium glass-chip hover:bg-white/[0.05] transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {t('analytics.exportRevenue')}
          </button>
        )}
      />

      <FilterPills
        filters={(['7d', '30d', '90d'] as Period[]).map(p => ({ key: p, label: periodLabels[p] }))}
        active={period}
        onChange={key => setPeriod(key as Period)}
      />

      {hasError && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-400">{t('common.loadError')}</p>
        </div>
      )}

      {showAnalyticsSkeleton ? (
        <PageSkeleton variant="kpi" count={3} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title={t('analytics.kpiRevenue', { defaultValue: 'Fatturato periodo' })}
              value={formatCurrency(totalRevenue)}
              icon={TrendingUp}
              accent="gold"
            />
            <KpiCard
              title={t('analytics.kpiOrders', { defaultValue: 'Ordini totali' })}
              value={totalOrders.toLocaleString(locale)}
              icon={ShoppingBag}
              accent="emerald"
            />
            <KpiCard
              title={t('analytics.kpiAvgTicket', { defaultValue: 'Scontrino medio' })}
              value={formatCurrency(avgOrder)}
              icon={Receipt}
              accent="blue"
            />
          </div>

          <LuxuryChartFrame
            eyebrow={periodLabels[period]}
            title={t('analytics.revenueChartTitle', { defaultValue: 'Fatturato nel tempo' })}
            subtitle={t('analytics.revenueChartSubtitle', { period: periodLabels[period] })}
            hero
          >
            <ChartSuspense height={300}>
              <LuxuryAreaChart
                data={revenue || []}
                dataKey="revenue"
                xKey="date"
                locale={locale}
                valueLabel={t('analytics.csvRevenue')}
                height={300}
              />
            </ChartSuspense>
          </LuxuryChartFrame>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <LuxuryChartFrame title={t('analytics.topItemsChart', { defaultValue: 'Top piatti per fatturato' })}>
              {pieData.length === 0 ? (
                <p className="py-12 text-center text-sm text-fumo">{t('analytics.noData', { defaultValue: 'Nessun dato disponibile' })}</p>
              ) : (
                <ChartSuspense height={260}>
                  <LuxuryBarChart
                    data={pieData}
                    dataKey="value"
                    xKey="name"
                    valueLabel={t('analytics.csvRevenue')}
                    height={260}
                    barSize={12}
                  />
                </ChartSuspense>
              )}
            </LuxuryChartFrame>

            <LuxuryChartFrame
              title={t('analytics.hourlyTraffic')}
              subtitle={peakHours.length > 0
                ? t('analytics.peakHours', { hours: peakHours.map((h: { hour: string }) => h.hour).join(', '), defaultValue: 'Ore di punta: {{hours}}' })
                : undefined}
            >
              <ChartSuspense height={220}>
                <LuxuryBarChart
                  data={hourly || []}
                  dataKey="orders"
                  xKey="hour"
                  valueLabel={t('analytics.csvOrders')}
                  height={220}
                  barSize={8}
                  accent="champagne"
                />
              </ChartSuspense>
            </LuxuryChartFrame>
          </div>

          <div className="premium-card overflow-hidden">
            <div className="p-5 border-b border-white/[0.08]">
              <h3 className="text-base font-semibold text-pietra">{t('analytics.menuAnalysis', { defaultValue: 'Analisi menu — Top 10' })}</h3>
            </div>
            <div className={ui.tableWrap}>
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="saas-table-head">
                    <th className="text-left text-xs font-semibold text-fumo uppercase px-5 py-3">#</th>
                    <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('analytics.colDish', { defaultValue: 'Piatto' })}</th>
                    <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('analytics.colCategory', { defaultValue: 'Categoria' })}</th>
                    <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('analytics.colQty', { defaultValue: 'Pz venduti' })}</th>
                    <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('analytics.colRevenue', { defaultValue: 'Fatturato' })}</th>
                    <th className="text-left text-xs font-semibold text-fumo uppercase px-4 py-3">{t('analytics.colPrice', { defaultValue: 'Prezzo' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {(topItems || []).map((item: { menuItemId: string; name: string; category: string; quantity: number; revenue: number; price: number }, i: number) => (
                    <tr key={item.menuItemId} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3 text-sm font-bold text-fumo">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-pietra">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-navy-surface text-fumo px-2 py-1 rounded-lg">{item.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-fumo">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-400">{formatCurrency(item.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-aura-gold font-medium">{formatCurrency(item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </ExecutivePageShell>
  )
}
