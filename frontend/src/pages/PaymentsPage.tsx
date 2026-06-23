import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { CreditCard, TrendingUp, ShoppingBag, AlertCircle, ExternalLink, CheckCircle2 } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { stripeApiKeysUrl, stripePaymentsUrl } from '../lib/stripeDashboard'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'
import { ui } from '../lib/ui'

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
  const { data, isLoading, isError, error, refetch } = useQuery<OverviewData>({
    queryKey: tq(tk, 'payments', 'overview'),
    queryFn: () => api.get('/payments/overview').then(r => r.data),
  })

  const apiError = error as { response?: { status?: number; data?: { error?: string; code?: string } } } | null
  const errorMessage = apiError?.response?.data?.error

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (isError) return (
    <div className="space-y-6">
      <div>
        <h1 className="aura-page-title">{t('payments.title')}</h1>
        <p className="aura-page-subtitle">{t('payments.subtitle')}</p>
      </div>
      <QueryErrorBanner message={errorMessage ?? t('common.loadError')} />
      <button
        type="button"
        onClick={() => refetch()}
        className={`${ui.btnPrimary} px-4 py-2.5 text-sm`}
      >
        {t('common.refresh')}
      </button>
    </div>
  )

  if (!data) return null

  const avgOrder = data.mese.count > 0 ? data.mese.amount / data.mese.count : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="aura-page-title">{t('payments.title')}</h1>
          <p className="aura-page-subtitle">{t('payments.subtitle')}</p>
          <p className="text-slate-500 text-sm mt-1">{t('payments.heroHint')}</p>
        </div>
        <a
          href={stripePaymentsUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#635BFF] hover:bg-[#5248e8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
          {t('payments.stripeDashboard')}
        </a>
      </div>

      {!data.stripeEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{t('payments.stripeNotConfigured')}</p>
            <p className="text-sm text-amber-700 mt-1">
              {t('payments.stripeNotConfiguredDesc')}{' '}
              <a href={stripeApiKeysUrl()} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                dashboard.stripe.com
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">{t('payments.monthRevenue')}</p>
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(data.mese.amount)}</p>
          <p className="text-xs text-slate-600 mt-1">{t('payments.transactions', { count: data.mese.count })}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">{t('payments.avgTicket')}</p>
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(avgOrder)}</p>
          <p className="text-xs text-slate-600 mt-1">{t('payments.perStripeOrder')}</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">{t('payments.lifetimeTotal')}</p>
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(data.totale.amount)}</p>
          <p className="text-xs text-slate-600 mt-1">{t('payments.totalOrders', { count: data.totale.count })}</p>
        </div>
      </div>

      <div className="glass-card p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4">{t('payments.monthlyChart', { year: new Date().getFullYear() })}</h2>
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
              formatter={(v) => [formatCurrency(Number(v) || 0), t('payments.revenueTooltip')]}
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
            />
            <Area type="monotone" dataKey="amount" stroke="#635BFF" strokeWidth={2} fill="url(#stripeGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-700">{t('payments.recentPayments')}</h2>
        </div>
        {data.recentPayments.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-600">
            <CreditCard className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">{t('payments.noPaymentsYet')}</p>
            <p className="text-xs mt-1">{t('payments.noPaymentsHint')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {data.recentPayments.map(order => (
              <div key={order.id} className="flex items-center gap-4 px-5 py-3.5 hover:glass-table-head transition-colors">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {order.items.map(i => `${i.quantity}× ${i.menuItem?.name ?? t('payments.unknownDish')}`).join(', ')}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {order.table
                      ? t('payments.tableOrder', { number: order.table.number })
                      : order.type === 'TAKEAWAY'
                        ? t('payments.takeaway')
                        : t('payments.qrOrder')}
                    {order.paidAt && ` · ${new Date(order.paidAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <span className="text-base font-black text-emerald-600">{formatCurrency(order.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-[#635BFF]/5 to-purple-50 border border-purple-100 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#635BFF]" />
          {t('payments.setupTitle')}
        </h3>
        <ol className="space-y-2 text-sm text-slate-500">
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">1.</span> {t('payments.setupStep1')}</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">2.</span> {t('payments.setupStep2')}</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">3.</span> {t('payments.setupStep3')}</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">4.</span> {t('payments.setupStep4')}</li>
        </ol>
      </div>
    </div>
  )
}
