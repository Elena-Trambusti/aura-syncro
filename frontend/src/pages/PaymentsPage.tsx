import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { CreditCard, TrendingUp, ShoppingBag, AlertCircle, ExternalLink, CheckCircle2 } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'

interface PaymentOrder {
  id: string
  total: number
  paidAt: string | null
  type: string
  table?: { number: number } | null
  items: { menuItem: { name: string }; quantity: number }[]
}

interface OverviewData {
  totale: { amount: number; count: number }
  mese: { amount: number; count: number }
  mensile: { month: string; amount: number; count: number }[]
  recentPayments: PaymentOrder[]
  stripeEnabled: boolean
}

export default function PaymentsPage() {
  const { t } = useTranslation()
  const tk = useTenantQueryKey()
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: tq(tk, 'payments', 'overview'),
    queryFn: () => api.get('/payments/overview').then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null

  const avgOrder = data.mese.count > 0 ? data.mese.amount / data.mese.count : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="aura-page-title">{t('payments.title')}</h1>
          <p className="aura-page-subtitle">{t('payments.subtitle')}</p>
          <p className="text-slate-500 text-sm mt-1">Incassi via Stripe dal menu QR</p>
        </div>
        <a
          href="https://dashboard.stripe.com/test/payments"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#5248e8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Dashboard Stripe
        </a>
      </div>

      {/* Banner configurazione */}
      {!data.stripeEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Stripe non configurato</p>
            <p className="text-sm text-amber-700 mt-1">
              Per attivare i pagamenti online, aggiungi le chiavi API nel file{' '}
              <code className="bg-amber-100 px-1 rounded text-xs">backend/.env</code>.{' '}
              Ottienile su{' '}
              <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                dashboard.stripe.com
              </a>
            </p>
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Incasso mese</p>
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(data.mese.amount)}</p>
          <p className="text-xs text-stone-500 mt-1">{data.mese.count} transazioni</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Scontrino medio</p>
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(avgOrder)}</p>
          <p className="text-xs text-stone-500 mt-1">per ordine Stripe</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">Totale storico</p>
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(data.totale.amount)}</p>
          <p className="text-xs text-stone-500 mt-1">{data.totale.count} ordini totali</p>
        </div>
      </div>

      {/* Grafico */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4">Incassi mensili {new Date().getFullYear()}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.mensile} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="stripeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#635BFF" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v) || 0), 'Incasso']}
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            />
            <Area type="monotone" dataKey="amount" stroke="#635BFF" strokeWidth={2} fill="url(#stripeGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ultimi pagamenti */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-800/50">
          <h2 className="text-sm font-bold text-slate-700">Ultimi pagamenti</h2>
        </div>
        {data.recentPayments.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-stone-500">
            <CreditCard className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nessun pagamento digitale ancora</p>
            <p className="text-xs mt-1">I pagamenti dal menu QR appariranno qui</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-800/40">
            {data.recentPayments.map(order => (
              <div key={order.id} className="flex items-center gap-4 px-5 py-3.5 hover:glass-table-head transition-colors">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {order.items.map(i => `${i.quantity}× ${i.menuItem.name}`).join(', ')}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {order.table ? `Tavolo ${order.table.number}` : order.type === 'TAKEAWAY' ? 'Asporto' : 'QR'}
                    {order.paidAt && ` · ${new Date(order.paidAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <span className="text-base font-black text-emerald-600">{formatCurrency(order.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guida attivazione */}
      <div className="bg-gradient-to-br from-[#635BFF]/5 to-purple-50 border border-purple-100 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#635BFF]" />
          Come attivare i pagamenti online
        </h3>
        <ol className="space-y-2 text-sm text-slate-500">
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">1.</span> Crea un account su <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-[#635BFF] underline">stripe.com</a></li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">2.</span> Vai in <strong>Sviluppatori → Chiavi API</strong> e copia le chiavi di test</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">3.</span> Incollale nel file <code className="bg-stone-800/50 px-1 rounded text-xs">backend/.env</code> (STRIPE_SECRET_KEY e STRIPE_PUBLISHABLE_KEY)</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">4.</span> Riavvia il backend — i clienti potranno pagare dal menu QR</li>
        </ol>
      </div>
    </div>
  )
}
