
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { downloadCSV } from '../lib/export'
import { Download } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

type Period = '7d' | '30d' | '90d'

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('30d')

  const { data: revenue } = useQuery({
    queryKey: ['analytics', 'revenue', period],
    queryFn: () => api.get(`/analytics/revenue?period=${period}`).then(r => r.data),
  })

  const { data: topItems } = useQuery({
    queryKey: ['analytics', 'top-items'],
    queryFn: () => api.get('/analytics/top-items').then(r => r.data),
  })

  const { data: hourly } = useQuery({
    queryKey: ['analytics', 'hourly'],
    queryFn: () => api.get('/analytics/hourly').then(r => r.data),
  })

  const totalRevenue = (revenue || []).reduce((s: number, d: { revenue: number }) => s + d.revenue, 0)
  const totalOrders = (revenue || []).reduce((s: number, d: { orders: number }) => s + d.orders, 0)
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const COLORS = ['#c9a227', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

  const pieData = (topItems || []).slice(0, 6).map((item: { name: string; quantity: number; revenue: number }) => ({
    name: item.name.length > 20 ? item.name.slice(0, 20) + '...' : item.name,
    value: item.revenue,
  }))

  const peakHours = (hourly || [])
    .filter((h: { orders: number }) => h.orders > 0)
    .sort((a: { orders: number }, b: { orders: number }) => b.orders - a.orders)
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="aura-page-title">{t('analytics.title')}</h1>
          <p className="aura-page-subtitle">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-amber-600 text-white' : 'bg-stone-900/55 border border-stone-700/50 text-stone-300'}`}>
              {p === '7d' ? '7 giorni' : p === '30d' ? '30 giorni' : '90 giorni'}
            </button>
          ))}
          <button
            onClick={() => {
              if (!revenue) return
              downloadCSV(
                `fatturato-${period}-${new Date().toISOString().split('T')[0]}.csv`,
                ['Data', 'Fatturato (€)', 'Ordini'],
                revenue.map((r: { date: string; revenue: number; orders: number }) => [
                  new Date(r.date).toLocaleDateString('it-IT'),
                  r.revenue.toFixed(2),
                  r.orders,
                ])
              )
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-stone-900/55 border border-stone-700/50 text-stone-300 hover:bg-stone-900/30 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Fatturato Periodo', value: formatCurrency(totalRevenue) },
          { label: 'Ordini Totali', value: totalOrders.toLocaleString('it-IT') },
          { label: 'Scontrino Medio', value: formatCurrency(avgOrder) },
        ].map(kpi => (
          <div key={kpi.label} className="bg-stone-900/55 rounded-2xl p-5 border border-stone-800/50 shadow-sm text-center">
            <p className="text-sm text-stone-400 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-stone-100">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Grafico fatturato */}
      <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
        <h3 className="text-base font-semibold text-stone-100 mb-4">Fatturato e Ordini nel Tempo</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={revenue || []}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c9a227" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date"
              tickFormatter={d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
              tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
            />
            <YAxis tickFormatter={v => `€${v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name) => [
                name === 'revenue' ? formatCurrency(Number(v) || 0) : v,
                name === 'revenue' ? 'Fatturato' : 'Ordini',
              ]}
              labelFormatter={d => new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'long' })}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#c9a227" strokeWidth={2.5} fill="url(#revenueGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Piatti top per fatturato */}
        <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
          <h3 className="text-base font-semibold text-stone-100 mb-4">Fatturato per Piatto (Top 6)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={false}>
                {pieData.map((_: unknown, index: number) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [formatCurrency(Number(v) || 0), 'Fatturato']} />
              <Legend formatter={(value) => <span className="text-xs text-stone-300">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Analisi fasce orarie */}
        <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
          <h3 className="text-base font-semibold text-stone-100 mb-2">Traffico per Ora</h3>
          {peakHours.length > 0 && (
            <p className="text-xs text-stone-400 mb-4">
              Ore di punta: {peakHours.map((h: { hour: string }) => h.hour).join(', ')}
            </p>
          )}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourly || []} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="orders" fill="#c9a227" radius={[4, 4, 0, 0]} name="Ordini" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabella piatti dettagliata */}
      <div className="bg-stone-900/55 rounded-2xl border border-stone-800/50 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-stone-800/50">
          <h3 className="text-base font-semibold text-stone-100">Analisi Menu — Top 10</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-stone-900/30">
              <th className="text-left text-xs font-semibold text-stone-400 uppercase px-5 py-3">#</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase px-4 py-3">Piatto</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase px-4 py-3">Categoria</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase px-4 py-3">Pz Venduti</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase px-4 py-3">Fatturato</th>
              <th className="text-left text-xs font-semibold text-stone-400 uppercase px-4 py-3">Prezzo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800/40">
            {(topItems || []).map((item: { menuItemId: string; name: string; category: string; quantity: number; revenue: number; price: number }, i: number) => (
              <tr key={item.menuItemId} className="hover:bg-stone-900/30">
                <td className="px-5 py-3 text-sm font-bold text-stone-500">{i + 1}</td>
                <td className="px-4 py-3 text-sm font-semibold text-stone-100">{item.name}</td>
                <td className="px-4 py-3"><span className="text-xs bg-stone-800/50 text-stone-300 px-2 py-1 rounded-lg">{item.category}</span></td>
                <td className="px-4 py-3 text-sm text-stone-300">{item.quantity}</td>
                <td className="px-4 py-3 text-sm font-bold text-emerald-600">{formatCurrency(item.revenue)}</td>
                <td className="px-4 py-3 text-sm text-amber-400 font-medium">{formatCurrency(item.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
