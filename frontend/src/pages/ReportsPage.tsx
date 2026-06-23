import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { TrendingUp, TrendingDown, FileText, Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart as RechartsPie, Pie, Legend } from 'recharts'
import { downloadCSV } from '../lib/export'
import { useFiscalRegime, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { tRegime } from '../lib/fiscalRegime'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import FilterPills from '../components/ui/FilterPills'
import KpiStatCard from '../components/ui/KpiStatCard'

interface PLSummary {
  revenue: number; subtotal: number; tax: number; totalDiscount: number; orders: number
  estimatedFoodCost: number; laborCost: number; grossProfit: number; netProfit: number
  foodCostPct: number; laborCostPct: number
}
interface PLData { period: { year: number; month: number }; summary: PLSummary; dailyBreakdown: { date: string; revenue: number; orders: number; discount: number }[] }
interface FoodCostItem { id: string; name: string; category: string; price: number; ingredientCost: number; margin: number; marginPct: number; soldQty: number; totalRevenue: number; totalCost: number }
interface CategoryData { name: string; revenue: number; qty: number }
interface YearlyData { year: number; months: { month: number; monthName: string; revenue: number; orders: number }[]; totalRevenue: number; bestMonth: { monthName: string; revenue: number } }

const MONTHS = ['', 'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const PIE_COLORS = ['#c9a227', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ef4444']

export default function ReportsPage() {
  const { t } = useTranslation()
  const fiscal = useFiscalRegime()
  const tk = useTenantQueryKey()
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [activeTab, setActiveTab] = useState<'pl' | 'foodcost' | 'annuale'>('pl')

  const { data: plData, isError: plError } = useQuery<PLData>({
    queryKey: tq(tk, 'reports', 'pl', selectedYear, selectedMonth),
    queryFn: () => api.get(`/reports/pl?year=${selectedYear}&month=${selectedMonth}`).then(r => r.data),
  })

  const { data: foodCost = [], isError: foodError } = useQuery<FoodCostItem[]>({
    queryKey: tq(tk, 'reports', 'foodcost'),
    queryFn: () => api.get('/reports/food-cost').then(r => r.data),
  })

  const { data: categories = [], isError: catError } = useQuery<CategoryData[]>({
    queryKey: tq(tk, 'reports', 'categories'),
    queryFn: () => api.get('/reports/categories').then(r => r.data),
  })

  const { data: yearly, isError: yearlyError } = useQuery<YearlyData>({
    queryKey: tq(tk, 'reports', 'yearly', selectedYear),
    queryFn: () => api.get(`/reports/yearly?year=${selectedYear}`).then(r => r.data),
  })

  const hasError = plError || foodError || catError || yearlyError

  const exportPL = () => {
    if (!plData) return
    downloadCSV(`pl-${selectedYear}-${selectedMonth}.csv`,
      ['Data', 'Incasso', 'Ordini', 'Sconti'],
      plData.dailyBreakdown.map(d => [d.date, d.revenue, d.orders, d.discount])
    )
  }

  const exportFoodCost = () => {
    downloadCSV('food-cost.csv',
      ['Piatto', 'Categoria', 'Prezzo', 'Costo Ingredienti', 'Margine', 'Margine %', 'Venduto (30g)', 'Fatturato'],
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
            <Link
              to="/report/fiscal"
              className="flex items-center gap-1.5 rounded-xl border border-aura-gold/30 bg-aura-gold/10 px-3 py-2 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-100"
            >
              <FileText className="h-4 w-4 shrink-0 text-aura-gold" aria-hidden />
              {t('reportFiscal.linkLabel')}
            </Link>
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm">
              {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
      />

      {hasError && <QueryErrorBanner message={t('reports.loadError')} />}

      <FilterPills
        filters={([
          { key: 'pl', label: t('reports.tabPl') },
          { key: 'foodcost', label: t('reports.tabFoodCost') },
          { key: 'annuale', label: t('reports.tabYearly') },
        ])}
        active={activeTab}
        onChange={key => setActiveTab(key as typeof activeTab)}
      />

      {!hasError && activeTab === 'pl' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Fatturato', value: formatCurrency(s?.revenue || 0), icon: TrendingUp, accent: 'emerald' as const, sub: `${s?.orders || 0} ordini` },
              { label: 'Food Cost', value: formatCurrency(s?.estimatedFoodCost || 0), icon: TrendingDown, accent: 'amber' as const, sub: `${s?.foodCostPct || 0}% del fatturato` },
              { label: 'Utile Lordo', value: formatCurrency(s?.grossProfit || 0), icon: TrendingUp, accent: 'blue' as const, sub: 'Ricavi - Food Cost' },
              { label: 'Utile Netto', value: formatCurrency(s?.netProfit || 0), icon: TrendingUp, accent: (s?.netProfit || 0) >= 0 ? 'gold' as const : 'rose' as const, sub: `Costo personale: ${formatCurrency(s?.laborCost || 0)}` },
            ].map(c => (
              <div key={c.label}>
                <KpiStatCard label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
                <p className="text-xs text-fumo mt-1 px-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Breakdown costi */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="premium-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-pietra">Dettaglio {MONTHS[selectedMonth]} {selectedYear}</h3>
                <button onClick={exportPL} className="flex items-center gap-1.5 text-xs text-aura-gold hover:text-amber-800 font-medium">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Fatturato lordo', value: s?.revenue || 0, positive: true },
                  { label: tRegime(t, fiscal.taxRegion, 'table.tax'), value: s?.tax || 0, positive: false, sub: true },
                  { label: 'Sconti applicati', value: -(s?.totalDiscount || 0), positive: false, sub: true },
                  { label: 'Food Cost stimato', value: -(s?.estimatedFoodCost || 0), positive: false },
                  { label: 'Costo personale', value: -(s?.laborCost || 0), positive: false },
                ].map(row => (
                  <div key={row.label} className={`flex justify-between items-center py-2 ${row.sub ? 'pl-4 text-xs text-fumo' : 'border-t border-white/[0.08] text-sm'}`}>
                    <span className={row.sub ? '' : 'font-medium text-fumo'}>{row.label}</span>
                    <span className={`font-semibold ${row.value >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>{formatCurrency(row.value)}</span>
                  </div>
                ))}
                <div className="border-t-2 border-white/[0.1] pt-3 flex justify-between">
                  <span className="font-bold text-pietra">Utile Netto Stimato</span>
                  <span className={`text-lg font-bold ${(s?.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>{formatCurrency(s?.netProfit || 0)}</span>
                </div>
              </div>
            </div>

            {/* Grafico giornaliero */}
            <div className="premium-card p-6">
              <h3 className="text-base font-semibold text-pietra mb-4">Andamento giornaliero</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={plData?.dailyBreakdown || []} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={d => new Date(d + 'T00:00:00').getDate().toString()} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), 'Incasso']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="revenue" fill="#c9a227" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {!hasError && activeTab === 'foodcost' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Categorie */}
            <div className="premium-card p-6">
              <h3 className="text-base font-semibold text-pietra mb-4">Fatturato per Categoria</h3>
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie data={categories} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} label={false}>
                    {categories.map((_: CategoryData, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), '']} />
                  <Legend formatter={v => <span className="text-xs text-fumo">{v}</span>} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            {/* Tabella food cost */}
            <div className="xl:col-span-2 premium-card overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
                <h3 className="text-base font-semibold text-pietra">Margini per Piatto</h3>
                <button onClick={exportFoodCost} className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-400 font-medium">
                  <Download className="w-3.5 h-3.5" /> Esporta CSV
                </button>
              </div>
              <div className="w-full max-w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="glass-table-head">
                    <tr>
                      {['Piatto', 'Prezzo', 'Food Cost', 'Margine', 'Margine %', 'Venduto'].map(h => (
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
                        <td className="px-4 py-3 text-fumo">{item.soldQty} pz</td>
                      </tr>
                    ))}
                    {foodCost.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-fumo text-sm py-8">Collega gli ingredienti ai piatti nel Magazzino per vedere il food cost</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trend Annuale */}
      {!hasError && activeTab === 'annuale' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="premium-card p-5 text-center">
              <p className="text-sm text-fumo">Fatturato {selectedYear}</p>
              <p className="text-2xl font-bold text-pietra mt-1">{formatCurrency(yearly?.totalRevenue || 0)}</p>
            </div>
            <div className="premium-card p-5 text-center">
              <p className="text-sm text-fumo">Mese Migliore</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{yearly?.bestMonth?.monthName || '—'}</p>
              <p className="text-sm text-fumo">{formatCurrency(yearly?.bestMonth?.revenue || 0)}</p>
            </div>
            <div className="premium-card p-5 text-center">
              <p className="text-sm text-fumo">Media Mensile</p>
              <p className="text-2xl font-bold text-pietra mt-1">{formatCurrency((yearly?.totalRevenue || 0) / 12)}</p>
            </div>
          </div>

          <div className="premium-card p-6">
            <h3 className="text-base font-semibold text-pietra mb-4">Fatturato Mensile {selectedYear}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yearly?.months || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), 'Fatturato']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="revenue" stroke="#c9a227" strokeWidth={3} dot={{ fill: '#c9a227', r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="premium-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="glass-table-head">
                <tr>
                  {['Mese', 'Fatturato', 'Ordini', 'Media/Ordine'].map(h => (
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
