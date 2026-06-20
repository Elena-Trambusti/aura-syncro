import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { getTenantTheme } from '../lib/tenantTheme'
import { BRAND } from '../lib/brand'
import {
  TrendingUp, TrendingDown, ShoppingBag, CalendarCheck,
  Users, AlertTriangle, ClipboardList,
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
  title, value, subtitle, icon: Icon, bgColor, trend,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  bgColor: string
  trend?: number
}) {
  return (
    <div className="rounded-2xl p-6 border border-stone-800 bg-stone-900/60 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-stone-400">{title}</p>
          <p className="text-2xl font-bold text-stone-100 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-stone-500 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}% vs mese scorso
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: bgColor }}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { restaurant } = useAuth()
  const theme = getTenantTheme(restaurant?.colorTheme)
  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: revenueData } = useQuery({
    queryKey: ['analytics', 'revenue', '7d'],
    queryFn: () => api.get('/analytics/revenue?period=7d').then(r => r.data),
  })

  const { data: topItems } = useQuery({
    queryKey: ['analytics', 'top-items'],
    queryFn: () => api.get('/analytics/top-items').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: BRAND.gold }}>
            {BRAND.name}
          </p>
          <h1 className="text-2xl font-bold text-stone-100">
            Dashboard — {restaurant?.name || 'Ristorante'}
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            {new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Incasso Oggi"
          value={formatCurrency(dashboard?.today.revenue || 0)}
          subtitle="ordini pagati oggi"
          icon={TrendingUp}
          bgColor="#10b981"
        />
        <StatCard
          title="Ordini Attivi"
          value={String(dashboard?.today.activeOrders || 0)}
          subtitle="tavoli con ordine aperto"
          icon={ClipboardList}
          bgColor={theme.color}
        />
        <StatCard
          title="Prenotazioni Oggi"
          value={String(dashboard?.today.reservations || 0)}
          subtitle="coperti confermati"
          icon={CalendarCheck}
          bgColor="#3b82f6"
        />
        <StatCard
          title="Fatturato Mensile"
          value={formatCurrency(dashboard?.month.revenue || 0)}
          icon={ShoppingBag}
          bgColor="#a855f7"
          trend={dashboard?.month.revenueGrowth}
        />
      </div>

      {/* Seconda riga */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Clienti Totali"
          value={String(dashboard?.totals.customers || 0)}
          subtitle="nel tuo CRM"
          icon={Users}
          bgColor="#6366f1"
        />
        <StatCard
          title="Allerte Magazzino"
          value={String(dashboard?.totals.lowStockAlerts || 0)}
          subtitle="prodotti sotto scorta minima"
          icon={AlertTriangle}
          bgColor={dashboard?.totals.lowStockAlerts ? '#ef4444' : '#94a3b8'}
        />
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl p-6 border border-stone-800 bg-stone-900/60">
          <h3 className="text-base font-semibold text-stone-100 mb-4">Andamento Fatturato — Ultimi 7 giorni</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData || []}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={theme.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
              <XAxis
                dataKey="date"
                tickFormatter={d => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `€${v}`}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [formatCurrency(Number(v) || 0), 'Fatturato']}
                labelFormatter={d => new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke={theme.color} strokeWidth={2.5} fill="url(#revenueGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl p-6 border border-stone-800 bg-stone-900/60">
          <h3 className="text-base font-semibold text-stone-100 mb-4">Top Piatti — Ultimi 30 giorni</h3>
          <div className="space-y-3">
            {(topItems || []).slice(0, 6).map((item: { menuItemId: string; name: string; quantity: number; revenue: number }, idx: number) => (
              <div key={item.menuItemId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-300 truncate">{item.name}</p>
                  <div className="w-full bg-stone-800 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(100, (item.quantity / ((topItems?.[0]?.quantity || 1))) * 100)}%`,
                        backgroundColor: theme.color,
                      }}
                    />
                  </div>
                </div>
                  <span className="text-xs font-semibold text-stone-400">{item.quantity} pz</span>
              </div>
            ))}
            {(!topItems || topItems.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">Nessun dato disponibile</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
