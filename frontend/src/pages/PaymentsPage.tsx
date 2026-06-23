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
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'
import KpiStatCard from '../components/ui/KpiStatCard'
import ModuleFrame from '../components/ui/ModuleFrame'

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
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />
      <PageSkeleton variant="kpi" count={3} />
      <PageSkeleton variant="table" count={5} />
    </ExecutivePageShell>
  )

  if (isError) return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />
      <QueryErrorBanner message={errorMessage ?? t('common.loadError')} />
      <button
        type="button"
        onClick={() => refetch()}
        className={`${ui.btnPrimary} px-4 py-2.5 text-sm`}
      >
        {t('common.refresh')}
      </button>
    </ExecutivePageShell>
  )

  if (!data) return null

  const avgOrder = data.mese.count > 0 ? data.mese.amount / data.mese.count : 0

  return (
    <ExecutivePageShell className="space-y-6">
      <ExecutivePageHeader
        title={t('payments.title')}
        subtitle={(
          <>
            <p>{t('payments.subtitle')}</p>
            <p className="text-fumo text-sm mt-1">{t('payments.heroHint')}</p>
          </>
        )}
        actions={(
          <a
            href={stripePaymentsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#635BFF] hover:bg-[#5248e8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            {t('payments.stripeDashboard')}
          </a>
        )}
      />

      {!data.stripeEnabled && (
        <div className="bg-aura-gold/10 border border-aura-gold/25 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-aura-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{t('payments.stripeNotConfigured')}</p>
            <p className="text-sm text-aura-gold mt-1">
              {t('payments.stripeNotConfiguredDesc')}{' '}
              <a href={stripeApiKeysUrl()} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                dashboard.stripe.com
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiStatCard
          label={t('payments.monthRevenue')}
          value={formatCurrency(data.mese.amount)}
          icon={TrendingUp}
          accent="emerald"
        />
        <KpiStatCard
          label={t('payments.avgTicket')}
          value={formatCurrency(avgOrder)}
          icon={CreditCard}
          accent="blue"
        />
        <KpiStatCard
          label={t('payments.lifetimeTotal')}
          value={formatCurrency(data.totale.amount)}
          icon={ShoppingBag}
          accent="gold"
        />
      </div>

      <ModuleFrame title={t('payments.monthlyChart', { year: new Date().getFullYear() })}>
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
      </ModuleFrame>

      <ModuleFrame title={t('payments.recentPayments')} bodyClassName="p-0">
        {data.recentPayments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={t('payments.noPaymentsYet')}
            description={t('payments.noPaymentsHint')}
          />
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {data.recentPayments.map(order => (
              <div key={order.id} className="flex items-center gap-4 px-5 py-3.5 hover:glass-table-head transition-colors">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-pietra">
                    {order.items.map(i => `${i.quantity}× ${i.menuItem?.name ?? t('payments.unknownDish')}`).join(', ')}
                  </p>
                  <p className="text-xs text-fumo mt-0.5">
                    {order.table
                      ? t('payments.tableOrder', { number: order.table.number })
                      : order.type === 'TAKEAWAY'
                        ? t('payments.takeaway')
                        : t('payments.qrOrder')}
                    {order.paidAt && ` · ${new Date(order.paidAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
                <span className="text-base font-black text-emerald-400">{formatCurrency(order.total)}</span>
              </div>
            ))}
          </div>
        )}
      </ModuleFrame>

      <div className="bg-gradient-to-br from-[#635BFF]/5 to-purple-50 border border-purple-100 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-pietra mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#635BFF]" />
          {t('payments.setupTitle')}
        </h3>
        <ol className="space-y-2 text-sm text-fumo">
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">1.</span> {t('payments.setupStep1')}</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">2.</span> {t('payments.setupStep2')}</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">3.</span> {t('payments.setupStep3')}</li>
          <li className="flex gap-2"><span className="text-[#635BFF] font-bold">4.</span> {t('payments.setupStep4')}</li>
        </ol>
      </div>
    </ExecutivePageShell>
  )
}
