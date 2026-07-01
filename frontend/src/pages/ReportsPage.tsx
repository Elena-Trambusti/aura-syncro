import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, monthYearInTimezone, toDateInputInTimezone } from '../lib/utils'
import { TrendingUp, TrendingDown, FileText, Download, Save } from 'lucide-react'
import { downloadCSV } from '../lib/export'
import { LuxuryChartFrame } from '../components/charts'
import { LuxuryAreaChart, LuxuryBarChart } from '../components/charts/lazy'
import ChartSuspense from '../components/charts/ChartSuspense'
import { useFiscalRegime, useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tRegime } from '../lib/fiscalRegime'
import { tq } from '../lib/queryKeys'
import { useRole } from '../hooks/useRole'
import { usePlanTier } from '../hooks/usePlanTier'
import { formatApiError } from '../lib/formatApiError'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import FilterPills from '../components/ui/FilterPills'
import KpiStatCard from '../components/ui/KpiStatCard'
import PageSkeleton from '../components/ui/PageSkeleton'
import { useMutation } from '@tanstack/react-query'
import { toast } from '@/lib/toast'

interface PLSummary {
  revenue: number; subtotal: number; tax: number; totalDiscount: number; orders: number
  estimatedFoodCost: number; laborCost: number; grossProfit: number; netProfit: number
  foodCostPct: number; laborCostPct: number
}
interface PLData { period: { year: number; month: number }; summary: PLSummary; dailyBreakdown: { date: string; revenue: number; orders: number; discount: number }[] }
interface FoodCostItem { id: string; name: string; category: string; price: number; ingredientCost: number; margin: number; marginPct: number; soldQty: number; totalRevenue: number; totalCost: number }
interface CategoryData { name: string; revenue: number; qty: number }
interface YearlyData { year: number; months: { month: number; monthName: string; revenue: number; orders: number }[]; totalRevenue: number; bestMonth: { monthName: string; revenue: number } }

export default function ReportsPage() {
  const { t } = useTranslation()
  const fiscal = useFiscalRegime()
  const { restaurant } = useAuth()
  const tenantTz = restaurant?.timezone ?? fiscal.timezone ?? 'Europe/Rome'
  const { canAccessAdminNav } = useRole()
  const { hasProPlan } = usePlanTier()
  const showZeta = fiscal.countryCode === 'IT' && canAccessAdminNav() && hasProPlan
  const tk = useTenantQueryKey()
  const defaultPeriod = monthYearInTimezone(tenantTz)
  const [selectedYear, setSelectedYear] = useState(defaultPeriod.year)
  const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.month)
  const [activeTab, setActiveTab] = useState<'pl' | 'foodcost' | 'annuale'>('pl')
  const [zetaDate, setZetaDate] = useState(() => toDateInputInTimezone(tenantTz))

  useEffect(() => {
    setZetaDate(toDateInputInTimezone(tenantTz))
  }, [tenantTz])

  const monthNames = t('reportFiscal.months', { returnObjects: true }) as string[]

  const { data: plData, isError: plError, isLoading: plLoading } = useQuery<PLData>({
    queryKey: tq(tk, 'reports', 'pl', selectedYear, selectedMonth),
    queryFn: () => api.get(`/reports/pl?year=${selectedYear}&month=${selectedMonth}`).then(r => r.data),
  })

  const { data: foodCost = [], isError: foodError, isLoading: foodLoading } = useQuery<FoodCostItem[]>({
    queryKey: tq(tk, 'reports', 'foodcost'),
    queryFn: () => api.get('/reports/food-cost').then(r => r.data),
  })

  const { data: categories = [], isError: catError } = useQuery<CategoryData[]>({
    queryKey: tq(tk, 'reports', 'categories'),
    queryFn: () => api.get('/reports/categories').then(r => r.data),
  })

  const { data: yearly, isError: yearlyError, isLoading: yearlyLoading } = useQuery<YearlyData>({
    queryKey: tq(tk, 'reports', 'yearly', selectedYear),
    queryFn: () => api.get(`/reports/yearly?year=${selectedYear}`).then(r => r.data),
  })

  const hasError = plError || foodError || catError || yearlyError
  const isLoading = plLoading || (activeTab === 'foodcost' && foodLoading) || (activeTab === 'annuale' && yearlyLoading)

  const exportPL = () => {
    if (!plData) return
    downloadCSV(`pl-${selectedYear}-${selectedMonth}.csv`,
      [t('reports.csvDate'), t('reports.csvRevenue'), t('reports.csvOrders'), t('reports.csvDiscounts')],
      plData.dailyBreakdown.map(d => [d.date, d.revenue, d.orders, d.discount])
    )
  }

  const { mutate: generateZeta, isPending: isGeneratingZeta } = useMutation({
    mutationFn: () => api.post('/reports/zeta', { date: zetaDate }).then(r => r.data),
    onSuccess: () => toast.success(t('reports.zetaSuccess')),
    onError: (err: unknown) => toast.error((err as { translatedMessage?: string }).translatedMessage ?? formatApiError(t, err, 'reports.zetaError')),
  })

  const exportFoodCost = () => {
    downloadCSV('food-cost.csv',
      [t('reports.csvDish'), t('reports.csvCategory'), t('reports.csvPrice'), t('reports.csvIngredientCost'), t('reports.csvMargin'), t('reports.csvMarginPct'), t('reports.csvSold30d'), t('reports.csvTurnover')],
      foodCost.map(i => [i.name, i.category, i.price, i.ingredientCost, i.margin, `${i.marginPct}%`, i.soldQty, i.totalRevenue])
    )
  }

  const s = plData?.summary

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('reports.title')}
        subtitle={(
          <>
            <p>{t('reports.subtitle')}</p>
            <p className="text-fumo text-sm mt-1">{t('reports.heroHint')}</p>
          </>
        )}
        actions={(
          <div className="flex items-center gap-2">
            {showZeta && (
              <>
                <input
                  type="date"
                  value={zetaDate}
                  onChange={e => setZetaDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  aria-label={t('reports.zetaDate', { defaultValue: 'Data chiusura Zeta' })}
                />
                <button
                  onClick={() => {
                    if (window.confirm(t('reports.zetaConfirm'))) {
                      generateZeta()
                    }
                  }}
                  disabled={isGeneratingZeta}
                  className="flex items-center gap-1.5 rounded-xl border border-aura-gold/25 bg-aura-gold/10 px-3 py-2 text-sm font-semibold text-aura-gold-light shadow-sm transition-colors hover:border-aura-gold/40 hover:bg-aura-gold/15 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 shrink-0 text-aura-gold" aria-hidden />
                  {isGeneratingZeta ? '...' : t('reports.zetaButton')}
                </button>
              </>
            )}
            {canAccessAdminNav() && (
            <Link
              to="/report/fiscal"
              className="flex items-center gap-1.5 rounded-xl border border-aura-gold/25 bg-aura-gold/10 px-3 py-2 text-sm font-semibold text-aura-gold-light transition-colors hover:border-aura-gold/40 hover:bg-aura-gold/15"
            >
              <FileText className="h-4 w-4 shrink-0 text-aura-gold" aria-hidden />
              {t('reportFiscal.linkLabel')}
            </Link>
            )}
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm">
              {[defaultPeriod.year - 1, defaultPeriod.year, defaultPeriod.year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm">
              {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
      />

      {hasError && <QueryErrorBanner message={t('reports.loadError')} />}
      {isLoading && !hasError && <PageSkeleton variant="cards" count={4} />}

      {!hasError && !isLoading && (
        <FilterPills
          filters={([
            { key: 'pl', label: t('reports.tabPl') },
            { key: 'foodcost', label: t('reports.tabFoodCost') },
            { key: 'annuale', label: t('reports.tabYearly') },
          ])}
          active={activeTab}
          onChange={key => setActiveTab(key as typeof activeTab)}
        />
      )}

      {!hasError && !isLoading && activeTab === 'pl' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: t('reports.kpiRevenue'), value: formatCurrency(s?.revenue || 0), icon: TrendingUp, accent: 'emerald' as const, sub: t('reports.ordersCount', { count: s?.orders || 0 }) },
              { label: t('reports.kpiFoodCost'), value: formatCurrency(s?.estimatedFoodCost || 0), icon: TrendingDown, accent: 'amber' as const, sub: t('reports.foodCostPctSub', { pct: s?.foodCostPct || 0 }) },
              { label: t('reports.kpiGrossProfit'), value: formatCurrency(s?.grossProfit || 0), icon: TrendingUp, accent: 'blue' as const, sub: t('reports.grossProfitSub') },
              { label: t('reports.kpiNetProfit'), value: formatCurrency(s?.netProfit || 0), icon: TrendingUp, accent: (s?.netProfit || 0) >= 0 ? 'gold' as const : 'rose' as const, sub: t('reports.laborCostSub', { amount: formatCurrency(s?.laborCost || 0) }) },
            ].map(c => (
              <div key={c.label}>
                <KpiStatCard label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
                <p className="text-xs text-fumo mt-1 px-1">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="premium-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-pietra">{t('reports.monthDetail', { month: monthNames[selectedMonth - 1], year: selectedYear })}</h3>
                <button onClick={exportPL} className="flex items-center gap-1.5 text-xs text-aura-gold hover:text-amber-800 font-medium">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: t('reports.rowGrossRevenue'), value: s?.revenue || 0, positive: true },
                  { label: t('reports.taxRowLabel', { taxName: tRegime(t, fiscal.taxRegion, 'table.tax'), rate: fiscal.taxRate }), value: s?.tax || 0, positive: false, sub: true },
                  { label: t('reports.rowDiscounts'), value: -(s?.totalDiscount || 0), positive: false, sub: true },
                  { label: t('reports.rowFoodCost'), value: -(s?.estimatedFoodCost || 0), positive: false },
                  { label: t('reports.rowLaborCost'), value: -(s?.laborCost || 0), positive: false },
                ].map(row => (
                  <div key={row.label} className={`flex justify-between items-center py-2 ${row.sub ? 'pl-4 text-xs text-fumo' : 'border-t border-white/[0.08] text-sm'}`}>
                    <span className={row.sub ? '' : 'font-medium text-fumo'}>{row.label}</span>
                    <span className={`font-semibold ${row.value >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>{formatCurrency(row.value)}</span>
                  </div>
                ))}
                <div className="border-t-2 border-white/[0.1] pt-3 flex justify-between">
                  <span className="font-bold text-pietra">{t('reports.netProfitEstimated')}</span>
                  <span className={`text-lg font-bold ${(s?.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>{formatCurrency(s?.netProfit || 0)}</span>
                </div>
              </div>
            </div>

            <LuxuryChartFrame title={t('reports.dailyTrend')}>
              <ChartSuspense height={220}>
                <LuxuryBarChart
                  data={plData?.dailyBreakdown || []}
                  dataKey="revenue"
                  xKey="date"
                  valueLabel={t('reports.tooltipRevenue')}
                  height={220}
                />
              </ChartSuspense>
            </LuxuryChartFrame>
          </div>
        </div>
      )}

      {!hasError && !isLoading && activeTab === 'foodcost' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <LuxuryChartFrame title={t('reports.categoryRevenue')}>
              <ChartSuspense height={220}>
                <LuxuryBarChart
                  data={categories}
                  dataKey="revenue"
                  xKey="name"
                  xTickFormatter={v => (v.length > 8 ? `${v.slice(0, 8)}…` : v)}
                  valueLabel={t('reports.kpiRevenue')}
                  height={220}
                  barSize={14}
                />
              </ChartSuspense>
            </LuxuryChartFrame>

            <div className="xl:col-span-2 premium-card overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
                <h3 className="text-base font-semibold text-pietra">{t('reports.dishMargins')}</h3>
                <button onClick={exportFoodCost} className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-400 font-medium">
                  <Download className="w-3.5 h-3.5" /> {t('reports.exportCsv')}
                </button>
              </div>
              <div className="w-full max-w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="glass-table-head">
                    <tr>
                      {[t('reports.colDish'), t('reports.colPrice'), t('reports.colFoodCost'), t('reports.colMargin'), t('reports.colMarginPct'), t('reports.colSold')].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fumo uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {foodCost.slice(0, 15).map(item => (
                      <tr key={item.id} className="hover:glass-table-head transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-pietra truncate min-w-0 max-w-full">{item.name}</p>
                          <p className="text-xs text-fumo">{item.category}</p>
                        </td>
                        <td className="px-4 py-3 text-fumo">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-red-500">{formatCurrency(item.ingredientCost)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">{formatCurrency(item.margin)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-navy-surface rounded-full h-1.5">
                              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, item.marginPct)}%`, backgroundColor: item.marginPct > 60 ? '#10b981' : item.marginPct > 30 ? '#f59e0b' : '#ef4444' }} />
                            </div>
                            <span className={`text-xs font-semibold ${item.marginPct > 60 ? 'text-emerald-400' : item.marginPct > 30 ? 'text-aura-gold' : 'text-red-500'}`}>{item.marginPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-fumo">{item.soldQty} {t('reports.pieces')}</td>
                      </tr>
                    ))}
                    {foodCost.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-fumo text-sm py-8">{t('reports.foodCostEmpty')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasError && !isLoading && activeTab === 'annuale' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="premium-card p-5 text-center">
              <p className="text-sm text-fumo">{t('reports.yearRevenue', { year: selectedYear })}</p>
              <p className="text-2xl font-bold text-pietra mt-1">{formatCurrency(yearly?.totalRevenue || 0)}</p>
            </div>
            <div className="premium-card p-5 text-center">
              <p className="text-sm text-fumo">{t('reports.bestMonth')}</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{yearly?.bestMonth?.monthName || '—'}</p>
              <p className="text-sm text-fumo">{formatCurrency(yearly?.bestMonth?.revenue || 0)}</p>
            </div>
            <div className="premium-card p-5 text-center">
              <p className="text-sm text-fumo">{t('reports.monthlyAvg')}</p>
              <p className="text-2xl font-bold text-pietra mt-1">{formatCurrency((yearly?.totalRevenue || 0) / 12)}</p>
            </div>
          </div>

          <LuxuryChartFrame title={t('reports.monthlyRevenue', { year: selectedYear })}>
            <ChartSuspense height={280}>
              <LuxuryAreaChart
                data={yearly?.months || []}
                dataKey="revenue"
                xKey="monthName"
                valueLabel={t('reports.kpiRevenue')}
                height={280}
                showYAxis
              />
            </ChartSuspense>
          </LuxuryChartFrame>

          <div className="premium-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="glass-table-head">
                <tr>
                  {[t('reports.colMonth'), t('reports.colRevenue'), t('reports.colOrders'), t('reports.colAvgOrder')].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fumo uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {(yearly?.months || []).map(m => (
                  <tr key={m.month} className="hover:glass-table-head transition-colors">
                    <td className="px-4 py-3 font-medium text-pietra">{m.monthName}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{formatCurrency(m.revenue)}</td>
                    <td className="px-4 py-3 text-fumo">{m.orders}</td>
                    <td className="px-4 py-3 text-fumo">{m.orders > 0 ? formatCurrency(m.revenue / m.orders) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ExecutivePageShell>
  )
}
