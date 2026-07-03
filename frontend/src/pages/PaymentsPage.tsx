import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { CreditCard, TrendingUp, ShoppingBag, AlertCircle, ExternalLink, CheckCircle2 } from 'lucide-react'
import { stripeApiKeysUrl } from '../lib/stripeDashboard'
import { useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import QueryErrorBanner from '../components/QueryErrorBanner'
import { ui } from '../lib/ui'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import PageSkeleton from '../components/ui/PageSkeleton'
import { useShowQuerySkeleton } from '../hooks/useShowQuerySkeleton'
import KpiStatCard from '../components/ui/KpiStatCard'
import ModuleFrame from '../components/ui/ModuleFrame'
import { LuxuryAreaChart } from '../components/charts/lazy'
import ChartSuspense from '../components/charts/ChartSuspense'
import { toast } from '@/lib/toast'

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
  stripeConnectAccountId: string | null
}

export default function PaymentsPage() {
  const { t } = useTranslation()
  const tk = useTenantQueryKey()
  const { data, isLoading, isError, error, refetch } = useQuery<OverviewData>({
    queryKey: tq(tk, 'payments', 'overview'),
    queryFn: () => api.get('/payments/overview').then(r => r.data),
  })
  const showPaymentsSkeleton = useShowQuerySkeleton(isLoading, data != null)

  const apiError = error as { response?: { status?: number; data?: { error?: string; code?: string } } } | null
  const errorMessage = apiError?.response?.data?.error

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

  if (!data && !showPaymentsSkeleton) return null

  const avgOrder = data && data.mese.count > 0 ? data.mese.amount / data.mese.count : 0

  const handleConnectStripe = async () => {
    try {
      const res = await api.post('/payments/connect-onboarding')
      window.location.href = res.data.url
    } catch (err) {
      console.error(err)
      toast.error(t('payments.stripeOnboardingError') || 'Errore durante la connessione a Stripe')
    }
  }

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
        actions={data ? (
          data.stripeConnectAccountId ? (
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-[#635BFF] hover:bg-[#5248e8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              {t('payments.stripeAccount', { defaultValue: 'Il tuo conto Stripe' })}
            </a>
          ) : (
            <button
              onClick={handleConnectStripe}
              className="flex items-center justify-center gap-2 bg-[#635BFF] hover:bg-[#5248e8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
              {t('payments.connectBank', { defaultValue: 'Collega conto bancario' })}
            </button>
          )
        ) : undefined}
      />

      {showPaymentsSkeleton ? (
        <>
          <PageSkeleton variant="kpi" count={3} />
          <PageSkeleton variant="table" count={5} />
        </>
      ) : data ? (
      <>
      {!data.stripeEnabled && (
        <div className="flex gap-3 rounded-2xl border border-aura-gold/20 bg-aura-gold/[0.06] p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-aura-gold" />
          <div>
            <p className="text-sm font-semibold text-pietra">{t('payments.stripeNotConfigured')}</p>
            <p className="mt-1 text-sm text-fumo">
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
        <ChartSuspense height={220}>
          <LuxuryAreaChart
            data={data.mensile}
            dataKey="amount"
            xKey="month"
            valueLabel={t('payments.revenueTooltip')}
            height={220}
            accent="violet"
          />
        </ChartSuspense>
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
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

      <div className="rounded-2xl border border-[#635BFF]/20 bg-[#635BFF]/[0.06] p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-pietra">
          <CreditCard className="h-4 w-4 text-[#8B7CFF]" />
          {t('payments.setupTitle')}
        </h3>
        <ol className="space-y-2 text-sm text-fumo">
          <li className="flex gap-2"><span className="font-bold text-[#8B7CFF]">1.</span> {t('payments.setupStep1')}</li>
          <li className="flex gap-2"><span className="font-bold text-[#8B7CFF]">2.</span> {t('payments.setupStep2')}</li>
          <li className="flex gap-2"><span className="font-bold text-[#8B7CFF]">3.</span> {t('payments.setupStep3')}</li>
          <li className="flex gap-2"><span className="font-bold text-[#8B7CFF]">4.</span> {t('payments.setupStep4')}</li>
        </ol>
      </div>
      </>
      ) : null}
    </ExecutivePageShell>
  )
}
