import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, formatLongDate, getIntlLocale } from '../lib/utils'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { usePlanTier } from '../hooks/usePlanTier'
import { tq } from '../lib/queryKeys'
import { getTenantTheme } from '../lib/tenantTheme'
import { BRAND } from '../lib/brand'
import {
  TrendingUp, TrendingDown, ShoppingBag, CalendarCheck,
  Users, AlertTriangle, ClipboardList, AlertCircle,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DashboardData {
  today: { orders: number; revenue: number; reservations: number; activeOrders: number }
  month: { revenue: number; revenueGrowth: number }
  totals: { customers: number; lowStockAlerts: number }
}

function StatCard({
  title, value, subtitle, icon: Icon, trend, trendLabel,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: number
  trendLabel?: (value: number) => string
}) {
  return (
    <div className="saas-card p-4 sm:p-6 relative z-0">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend !== undefined && trendLabel && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendLabel(Math.abs(trend))}
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-slate-200 bg-slate-50">
          <Icon className="w-6 h-6 text-amber-500" />
        </div>
      </div>
    </div>
  )
}

function ChartError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      <AlertCircle className="w-8 h-8 mb-2 text-red-400" />
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const tk = useTenantQueryKey()
  const { hasProPlan } = usePlanTier()
  const theme = getTenantTheme(restaurant?.colorTheme)
  const locale = getIntlLocale()

  const { data: dashboard, isError: summaryError } = useQuery<DashboardData>({
    queryKey: tq(tk, 'analytics', 'summary'),
    queryFn: () => api.get('/analytics/summary').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: revenueData, isError: revenueError } = useQuery({
    queryKey: tq(tk, 'analytics', 'revenue', '7d'),
    queryFn: () => api.get('/analytics/revenue?period=7d').then(r => r.data),
    enabled: hasProPlan,
  })

  const { data: topItems, isError: topItemsError } = useQuery({
    queryKey: tq(tk, 'analytics', 'top-items'),
    queryFn: () => api.get('/analytics/top-items').then(r => r.data),
    enabled: hasProPlan,
  })

  return (
    <div className="pwa-mobile-page">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: BRAND.gold }}>
            {BRAND.name}
          </p>
          <h1 className="aura-page-title">
            {t('dashboard.title', { name: restaurant?.name || t('common.restaurant') })}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{formatLongDate()}</p>
        </div>
      </div>

      {summaryError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{t('common.loadError')}</p>
        </div>
      )}

      <div className="pwa-stat-grid">
        <StatCard
          title={t('dashboard.todayRevenue')}
          value={formatCurrency(dashboard?.today.revenue || 0)}
          subtitle={t('dashboard.todayRevenueSub')}
          icon={TrendingUp}
        />
        <StatCard
          title={t('dashboard.activeOrders')}
          value={String(dashboard?.today.activeOrders || 0)}
          subtitle={t('dashboard.activeOrdersSub')}
          icon={ClipboardList}
        />
        <StatCard
          title={t('dashboard.todayReservations')}
          value={String(dashboard?.today.reservations || 0)}
          subtitle={t('dashboard.todayReservationsSub')}
          icon={CalendarCheck}
        />
        <StatCard
          title={t('dashboard.monthlyRevenue')}
          value={formatCurrency(dashboard?.month.revenue || 0)}
          icon={ShoppingBag}
          trend={dashboard?.month.revenueGrowth}
          trendLabel={v => t('dashboard.vsLastMonth', { value: v })}
        />
      </div>

      <div className="pwa-stat-grid-2">
        <StatCard
          title={t('dashboard.totalCustomers')}
          value={String(dashboard?.totals.customers || 0)}
          subtitle={t('dashboard.totalCustomersSub')}
          icon={Users}
        />
        <StatCard
          title={t('dashboard.stockAlerts')}
          value={String(dashboard?.totals.lowStockAlerts || 0)}
          subtitle={t('dashboard.stockAlertsSub')}
          icon={AlertTriangle}
        />
      </div>

      {hasProPlan && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
          <div className="xl:col-span-2 pwa-chart-card">
            <h3 className="text-base font-semibold text-slate-900 mb-3 sm:mb-4 tracking-wide">{t('dashboard.revenueChart')}</h3>
            {revenueError ? (
              <ChartError message={t('common.loadError')} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueData || []}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={theme.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => new Date(d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => `€${v}`}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [formatCurrency(Number(v) || 0), t('dashboard.revenueLabel')]}
                    labelFormatter={d => new Date(d).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke={theme.color} strokeWidth={2.5} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pwa-chart-card">
            <h3 className="text-base font-semibold text-slate-900 mb-4 tracking-wide">{t('dashboard.topDishes')}</h3>
            {topItemsError ? (
              <ChartError message={t('common.loadError')} />
            ) : (
              <div className="space-y-3">
                {(topItems || []).slice(0, 6).map((item: { menuItemId: string; name: string; quantity: number; revenue: number }, idx: number) => (
                  <div key={item.menuItemId} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(100, (item.quantity / ((topItems?.[0]?.quantity || 1))) * 100)}%`,
                            backgroundColor: theme.color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{item.quantity} {t('common.pieces')}</span>
                  </div>
                ))}
                {(!topItems || topItems.length === 0) && (
                  <p className="text-sm text-slate-500 text-center py-4">{t('common.noData')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
