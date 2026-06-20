import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import {
  Brain, TrendingUp, TrendingDown, Package, BookOpen,
  AlertTriangle, CheckCircle2, Info, Zap, ChevronRight,
  Sparkles, Target, BarChart2, ShoppingCart,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from 'recharts'

// ── Tipi ──────────────────────────────────────────────────────────────────────

interface ForecastDay {
  date: string; dayLabel: string
  predictedRevenue: number; predictedCovers: number
  trend: number; confidence: number; suggestion: string; historicalSamples: number
}

interface ReorderItem {
  id: string; name: string; unit: string
  currentQty: number; minQty: number; dailyConsumption: number
  daysLeft: number | null; suggestedOrderQty: number
  urgency: 'critical' | 'warning' | 'ok' | 'idle'
  reason: string; supplier?: string; estimatedCost: number
}

interface MatrixItem {
  id: string; name: string; category: string; price: number
  qty30d: number; revenue30d: number
  quadrant: 'star' | 'plowhorse' | 'puzzle' | 'dog'
  label: string; action: string; color: string
}

interface Alert {
  id: string; type: 'danger' | 'warning' | 'success' | 'info'
  title: string; description: string; value?: string; action?: string
}

// ── Componenti UI ─────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void
  icon: React.ElementType; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
        active ? 'bg-violet-600 text-white shadow-md' : 'glass-chip text-stone-300 hover:bg-white/[0.06]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const styles = {
    danger: { bg: 'bg-red-950/40 border-red-200', icon: AlertTriangle, iconColor: 'text-red-500', titleColor: 'text-red-800' },
    warning: { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500', titleColor: 'text-amber-800' },
    success: { bg: 'bg-emerald-950/40 border-emerald-200', icon: CheckCircle2, iconColor: 'text-emerald-500', titleColor: 'text-emerald-800' },
    info: { bg: 'bg-blue-950/40 border-blue-200', icon: Info, iconColor: 'text-blue-500', titleColor: 'text-blue-800' },
  }
  const s = styles[alert.type]
  const Icon = s.icon
  return (
    <div className={`${s.bg} border rounded-2xl p-4 flex gap-3`}>
      <Icon className={`w-5 h-5 ${s.iconColor} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-bold ${s.titleColor}`}>{alert.title}</p>
          {alert.value && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              alert.type === 'danger' ? 'bg-red-100 text-red-700' :
              alert.type === 'warning' ? 'bg-amber-100 text-amber-700' :
              alert.type === 'success' ? 'bg-emerald-950/50 text-emerald-400' :
              'bg-blue-100 text-blue-700'
            }`}>{alert.value}</span>
          )}
        </div>
        <p className="text-xs text-stone-300 mt-1">{alert.description}</p>
        {alert.action && (
          <p className="text-xs font-semibold text-violet-600 mt-2 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" /> {alert.action}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Sezione Previsioni ────────────────────────────────────────────────────────
function ForecastSection() {
  const { data, isLoading } = useQuery<{ forecast: ForecastDay[] }>({
    queryKey: ['ai', 'forecast'],
    queryFn: () => api.get('/ai/forecast').then(r => r.data),
  })

  if (isLoading) return <LoadingSkeleton />
  if (!data) return null
  const { forecast } = data

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-stone-200 mb-4">Ricavi previsti — prossimi 7 giorni</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={forecast} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v) || 0), 'Ricavo previsto']}
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            />
            <Area type="monotone" dataKey="predictedRevenue" stroke="#7c3aed" strokeWidth={2.5} fill="url(#forecastGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {forecast.map(day => (
          <div key={day.date} className="glass-card p-4 flex items-center gap-4">
            <div className="w-14 text-center shrink-0">
              <p className="text-xs font-bold text-stone-400">{day.dayLabel.slice(0, 3).toUpperCase()}</p>
              <p className="text-sm font-black text-stone-100">{new Date(day.date).getDate()}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-base font-black text-stone-100">{formatCurrency(day.predictedRevenue)}</span>
                <span className="text-xs text-stone-500">~{day.predictedCovers} coperti</span>
                {day.trend !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-semibold ${day.trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {day.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {day.trend > 0 ? '+' : ''}{day.trend}%
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 truncate">{day.suggestion}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className={`text-xs px-2 py-1 rounded-full font-semibold ${
                day.confidence >= 70 ? 'bg-emerald-950/50 text-emerald-400' :
                day.confidence >= 50 ? 'bg-amber-100 text-amber-700' :
                'bg-stone-800/50 text-stone-400'
              }`}>
                {day.confidence}% conf.
              </div>
              {day.historicalSamples > 0 && (
                <p className="text-xs text-stone-500 mt-1">{day.historicalSamples} campioni</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sezione Riordino ──────────────────────────────────────────────────────────
function ReorderSection() {
  const { data, isLoading } = useQuery<{ suggestions: ReorderItem[]; summary: { critical: number; warning: number; totalCost: number } }>({
    queryKey: ['ai', 'reorder'],
    queryFn: () => api.get('/ai/reorder').then(r => r.data),
  })

  if (isLoading) return <LoadingSkeleton />
  if (!data) return null
  const { suggestions, summary } = data

  const urgencyConfig = {
    critical: { bg: 'bg-red-950/40 border-red-200', badge: 'bg-red-100 text-red-700', dot: 'bg-red-950/400', label: 'Critico' },
    warning: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400', label: 'Attenzione' },
    ok: { bg: 'glass-card border-white/10', badge: 'bg-emerald-950/50 text-emerald-400', dot: 'bg-emerald-950/400', label: 'OK' },
    idle: { bg: 'glass-table-head border-stone-800/50', badge: 'bg-stone-800/50 text-stone-400', dot: 'bg-slate-300', label: 'Inattivo' },
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-950/40 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-red-700">{summary.critical}</p>
          <p className="text-xs text-red-600 font-medium mt-1">Critici</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-amber-700">{summary.warning}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">Da riordinare</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-lg font-black text-stone-100">{formatCurrency(summary.totalCost)}</p>
          <p className="text-xs text-stone-400 font-medium mt-1">Costo riordino</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {suggestions.filter(s => s.urgency !== 'idle').map(item => {
          const cfg = urgencyConfig[item.urgency]
          return (
            <div key={item.id} className={`${cfg.bg} border rounded-2xl p-4 flex items-center gap-4`}>
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-stone-100">{item.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cfg.badge}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-stone-400">{item.reason}</p>
                {item.supplier && <p className="text-xs text-stone-500 mt-0.5">Fornitore: {item.supplier}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-stone-100">
                  {item.currentQty} {item.unit}
                </p>
                {item.suggestedOrderQty > 0 && (
                  <p className="text-xs text-violet-600 font-semibold mt-0.5">
                    Ordina +{item.suggestedOrderQty} {item.unit}
                  </p>
                )}
                {item.daysLeft !== null && (
                  <p className="text-xs text-stone-500">{item.daysLeft}g rimanenti</p>
                )}
              </div>
            </div>
          )
        })}
        {suggestions.filter(s => s.urgency !== 'idle').length === 0 && (
          <div className="bg-emerald-950/40 border border-emerald-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-700">Scorte nella norma</p>
            <p className="text-xs text-emerald-600 mt-1">Nessun riordino urgente rilevato</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sezione Matrice Menu ──────────────────────────────────────────────────────
function MenuMatrixSection() {
  const [activeQuadrant, setActiveQuadrant] = useState<string | null>(null)
  const { data, isLoading } = useQuery<{
    matrix: MatrixItem[]
    summary: { stars: number; plowhorses: number; puzzles: number; dogs: number; totalRevenue30d: number; topItem: string }
    medianQty: number; medianMargin: number
  }>({
    queryKey: ['ai', 'menu-matrix'],
    queryFn: () => api.get('/ai/menu-matrix').then(r => r.data),
  })

  if (isLoading) return <LoadingSkeleton />
  if (!data) return null
  const { matrix, summary } = data

  const quadrants = [
    { key: 'star', label: '⭐ Star', desc: 'Alto volume + alto margine', count: summary.stars, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { key: 'plowhorse', label: '🐴 Trainante', desc: 'Alto volume + basso margine', count: summary.plowhorses, color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { key: 'puzzle', label: '🔮 Potenziale', desc: 'Basso volume + alto margine', count: summary.puzzles, color: 'bg-purple-100 text-purple-800 border-purple-200' },
    { key: 'dog', label: '🐕 Da rivedere', desc: 'Basso volume + basso margine', count: summary.dogs, color: 'bg-stone-800/50 text-stone-300 border-stone-700/50' },
  ]

  const scatterData = matrix.map(item => ({
    x: item.qty30d,
    y: item.price,
    z: item.revenue30d + 100,
    name: item.name,
    quadrant: item.quadrant,
    color: item.color,
  }))

  const filtered = activeQuadrant ? matrix.filter(i => i.quadrant === activeQuadrant) : matrix

  return (
    <div className="space-y-5">
      {/* Scatter plot */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-stone-200 mb-1">Mappa posizionamento piatti (30 giorni)</h3>
        <p className="text-xs text-stone-500 mb-4">X = volumi venduti · Y = prezzo unitario · Dimensione = fatturato</p>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" name="Vendite" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} label={{ value: 'Vendite', position: 'insideBottomRight', fontSize: 10, fill: '#94a3b8' }} />
            <YAxis dataKey="y" name="Prezzo" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <ZAxis dataKey="z" range={[40, 400]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="glass-card p-3 text-xs shadow-lg">
                    <p className="font-bold text-stone-100 mb-1">{d.name}</p>
                    <p className="text-stone-400">{d.x} vendite · €{d.y}</p>
                  </div>
                )
              }}
            />
            {['star', 'plowhorse', 'puzzle', 'dog'].map(q => (
              <Scatter
                key={q}
                data={scatterData.filter(d => d.quadrant === q)}
                fill={q === 'star' ? '#f59e0b' : q === 'plowhorse' ? '#3b82f6' : q === 'puzzle' ? '#8b5cf6' : '#94a3b8'}
                fillOpacity={0.8}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Quadrant cards */}
      <div className="grid grid-cols-2 gap-3">
        {quadrants.map(q => (
          <button
            key={q.key}
            onClick={() => setActiveQuadrant(activeQuadrant === q.key ? null : q.key)}
            className={`border rounded-2xl p-4 text-left transition-all ${q.color} ${activeQuadrant === q.key ? 'ring-2 ring-violet-500' : ''}`}
          >
            <p className="text-sm font-bold">{q.label}</p>
            <p className="text-xs opacity-70 mt-0.5">{q.desc}</p>
            <p className="text-2xl font-black mt-2">{q.count}</p>
            <p className="text-xs opacity-60">piatt{q.count !== 1 ? 'i' : 'o'}</p>
          </button>
        ))}
      </div>

      {/* Lista piatti */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-800/50 flex items-center justify-between">
          <p className="text-sm font-bold text-stone-200">
            {activeQuadrant ? `${quadrants.find(q => q.key === activeQuadrant)?.label} — ` : 'Tutti i piatti — '}
            {filtered.length} risultati
          </p>
          {activeQuadrant && (
            <button onClick={() => setActiveQuadrant(null)} className="text-xs text-violet-600 font-semibold">Mostra tutti</button>
          )}
        </div>
        <div className="divide-y divide-stone-800/40 max-h-80 overflow-y-auto">
          {filtered.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-100">{item.name}</p>
                <p className="text-xs text-stone-500">{item.category}</p>
                <p className="text-xs text-violet-600 mt-0.5">{item.action}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-stone-100">{formatCurrency(item.revenue30d)}</p>
                <p className="text-xs text-stone-500">{item.qty30d} vendite</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sezione Alert ─────────────────────────────────────────────────────────────
function AlertsSection() {
  const { data, isLoading } = useQuery<{ alerts: Alert[]; generatedAt: string }>({
    queryKey: ['ai', 'alerts'],
    queryFn: () => api.get('/ai/alerts').then(r => r.data),
  })

  if (isLoading) return <LoadingSkeleton />
  if (!data) return null

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        Analisi aggiornata il {new Date(data.generatedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
      </p>
      {data.alerts.length === 0 ? (
        <div className="bg-emerald-950/40 border border-emerald-200 rounded-2xl p-8 text-center">
          <Sparkles className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-emerald-700">Tutto sotto controllo</p>
          <p className="text-xs text-emerald-600 mt-1">Nessuna anomalia rilevata al momento</p>
        </div>
      ) : (
        data.alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card p-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-stone-800/50 rounded w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ── Pagina principale ─────────────────────────────────────────────────────────
export default function AIPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'alerts' | 'forecast' | 'reorder' | 'matrix'>('alerts')

  const { data: summary } = useQuery<{
    tomorrow: { dayLabel: string; predictedRevenue: number; predictedCovers: number; samples: number }
    criticalStock: number
  }>({
    queryKey: ['ai', 'summary'],
    queryFn: () => api.get('/ai/summary').then(r => r.data),
  })

  const tabs = [
    { key: 'alerts' as const, icon: Zap, label: 'Alert' },
    { key: 'forecast' as const, icon: TrendingUp, label: 'Previsioni' },
    { key: 'reorder' as const, icon: Package, label: 'Riordino' },
    { key: 'matrix' as const, icon: BookOpen, label: 'Menu Matrix' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <h1 className="aura-page-title">{t('ai.title')}</h1>
            <p className="aura-page-subtitle">{t('ai.subtitle')}</p>
          </div>
          <p className="text-stone-400 text-sm">Insights intelligenti basati sui tuoi dati storici</p>
        </div>
        <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">
          <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-violet-700">AI attiva</span>
        </div>
      </div>

      {/* Widget sommario */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-4 text-white col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 opacity-80" />
              <p className="text-xs font-semibold opacity-80">Previsione domani — {summary.tomorrow.dayLabel}</p>
            </div>
            <p className="text-3xl font-black">{formatCurrency(summary.tomorrow.predictedRevenue)}</p>
            <p className="text-sm opacity-80 mt-1">~{summary.tomorrow.predictedCovers} coperti previsti</p>
            {summary.tomorrow.samples > 0 && (
              <p className="text-xs opacity-60 mt-1">Basato su {summary.tomorrow.samples} {summary.tomorrow.dayLabel} storici</p>
            )}
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-stone-500" />
              <p className="text-xs font-medium text-stone-400">Modello</p>
            </div>
            <p className="text-sm font-bold text-stone-100">Media mobile</p>
            <p className="text-xs text-stone-500 mt-1">per giorno settimana</p>
          </div>
          <div className={`rounded-2xl p-4 border shadow-sm ${summary.criticalStock > 0 ? 'bg-red-950/40 border-red-200' : 'bg-emerald-950/40 border-emerald-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className={`w-4 h-4 ${summary.criticalStock > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
              <p className={`text-xs font-medium ${summary.criticalStock > 0 ? 'text-red-600' : 'text-emerald-600'}`}>Scorte critiche</p>
            </div>
            <p className={`text-2xl font-black ${summary.criticalStock > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{summary.criticalStock}</p>
            <p className={`text-xs mt-1 ${summary.criticalStock > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {summary.criticalStock > 0 ? 'prodotti da riordinare' : 'tutto nella norma'}
            </p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} icon={t.icon} label={t.label} />
        ))}
      </div>

      {/* Contenuto tab */}
      {tab === 'alerts' && <AlertsSection />}
      {tab === 'forecast' && <ForecastSection />}
      {tab === 'reorder' && <ReorderSection />}
      {tab === 'matrix' && <MenuMatrixSection />}
    </div>
  )
}
