
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
import FilterPills from '../components/ui/FilterPills'
import { Download, AlertCircle, TrendingUp, ShoppingBag, Receipt, Clock } from 'lucide-react'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

type Period = '7d' | '30d' | '90d'

const CHART_COLORS = ['#D4AF37', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']
const GRID_STROKE = 'rgba(255,255,255,0.06)'
const TICK_FILL = '#94a3b8'

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: '#1A1D26',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  color: '#E8E6E3',
}

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

      {isLoading ? (
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

          <div className="premium-card p-5 sm:p-6">
            <h3 className="text-base font-semibold text-pietra mb-1">{t('analytics.revenueChartTitle', { defaultValue: 'Fatturato nel tempo' })}</h3>
            <p className="text-sm text-fumo mb-5">{t('analytics.revenueChartSubtitle', { period: periodLabels[period] })}</p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenue || []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => new Date(d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}
                  tick={{ fontSize: 11, fill: TICK_FILL }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `€${v}`}
                  tick={{ fontSize: 11, fill: TICK_FILL }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v, name) => [
                    name === 'revenue' ? formatCurrency(Number(v) || 0) : v,
                    name === 'revenue' ? t('analytics.csvRevenue') : t('analytics.csvOrders'),
                  ]}
                  labelFormatter={d => new Date(d).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'long' })}
                  contentStyle={tooltipStyle}
                />
                <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2.5} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="premium-card p-5 sm:p-6">
              <h3 className="text-base font-semibold text-pietra mb-4">{t('analytics.topItemsChart', { defaultValue: 'Top piatti per fatturato' })}</h3>
              {pieData.length === 0 ? (
                <p className="text-sm text-fumo text-center py-12">{t('analytics.noData', { defaultValue: 'Nessun dato disponibile' })}</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" paddingAngle={2}>
                      {pieData.map((_: unknown, index: number) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), t('analytics.csvRevenue')]} contentStyle={tooltipStyle} />
                    <Legend formatter={(value) => <span className="text-xs text-fumo">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="premium-card p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-aura-gold" />
                <h3 className="text-base font-semibold text-pietra">{t('analytics.hourlyTraffic')}</h3>
              </div>
              {peakHours.length > 0 && (
                <p className="text-xs text-fumo mb-4">
                  {t('analytics.peakHours', { hours: peakHours.map((h: { hour: string }) => h.hour).join(', '), defaultValue: 'Ore di punta: {{hours}}' })}
                </p>
              )}
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourly || []} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="orders" fill="#D4AF37" radius={[4, 4, 0, 0]} name={t('analytics.csvOrders')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
