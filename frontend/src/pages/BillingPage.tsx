import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, CheckCircle2, XCircle, X, ExternalLink } from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '../lib/api'
import { formatCurrency, cn } from '../lib/utils'
import { formatApiError } from '../lib/errors'
import { BRAND } from '../lib/brand'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'

const BRAND_LOGO_SRC = '/brand/aura-syncro-logo-tally.svg'

const PLAN_IDS = ['STARTER', 'PREMIUM'] as const
type PlanId = typeof PLAN_IDS[number]

const PLAN_PRICES: Record<PlanId, { price: number; setup: number }> = {
  STARTER: { price: 99, setup: 250 },
  PREMIUM: { price: 199, setup: 500 },
}

export default function BillingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { restaurant } = useAuth()
  const tk = useTenantQueryKey()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasSubscription = restaurant?.hasActiveSubscription === true
  const activePlanId = (restaurant?.subscriptionPlan || 'STARTER') as PlanId

  const { data: restaurantData } = useQuery<{ settings?: { hasStripeBilling?: boolean } | null }>({
    queryKey: tq(tk, 'restaurant'),
    queryFn: () => api.get('/restaurant').then(r => r.data),
    enabled: hasSubscription,
  })
  const hasStripeBilling = restaurantData?.settings?.hasStripeBilling === true

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success(t('billing.checkoutSuccess'))
      setSearchParams({}, { replace: true })
    }
    if (searchParams.get('canceled') === 'true') {
      toast(t('billing.checkoutCanceled'), { icon: 'ℹ️' })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, t])

  const handleActivatePlan = async (planId: string) => {
    setLoadingPlan(planId)
    setError(null)

    try {
      const { data } = await api.post<{ checkoutUrl: string }>('/checkout', { plan: planId })
      if (!data.checkoutUrl) {
        throw new Error(t('billing.checkoutUrlMissing'))
      }
      window.location.href = data.checkoutUrl
    } catch (err: unknown) {
      setError(formatApiError(err))
      setLoadingPlan(null)
    }
  }

  const openBillingPortal = async () => {
    setOpeningPortal(true)
    setError(null)
    try {
      const { data } = await api.post<{ portalUrl: string }>('/checkout/portal')
      if (!data.portalUrl) throw new Error(t('billing.portalUrlMissing', { defaultValue: 'URL portale non ricevuto' }))
      window.location.href = data.portalUrl
    } catch (err: unknown) {
      setError(formatApiError(err))
      setOpeningPortal(false)
    }
  }

  const planFeatures = (id: PlanId) =>
    t(`billing.plans.${id.toLowerCase()}.features`, { returnObjects: true }) as string[]

  const planMissing = (id: PlanId) =>
    t(`billing.plans.${id.toLowerCase()}.missing`, { returnObjects: true, defaultValue: [] }) as string[]

  return (
    <ExecutivePageShell className="mx-auto max-w-5xl space-y-8">
      <ExecutivePageHeader
        title={t('billing.plansPageTitle', { defaultValue: 'Piani e fatturazione' })}
        subtitle={t('billing.plansPageSubtitle', { defaultValue: 'Gestisci il tuo abbonamento ad Aura Syncro' })}
        meta={(
          <img
            src={BRAND_LOGO_SRC}
            alt={BRAND.name}
            className="mt-4 h-12 w-auto sm:h-14"
          />
        )}
      />

      {hasSubscription && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-900">
              {t('billing.activePlanLabel', {
                plan: t(`billing.plans.${activePlanId.toLowerCase()}.name`),
                defaultValue: 'Abbonamento attivo: {{plan}}',
              })}
            </p>
          </div>
          {hasStripeBilling && (
            <button
              type="button"
              onClick={() => void openBillingPortal()}
              disabled={openingPortal}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
            >
              {openingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {t('billing.openPortal', { defaultValue: 'Gestisci abbonamento' })}
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-800"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!hasSubscription && (
        <div className="grid gap-8 md:grid-cols-2">
          {PLAN_IDS.map(planId => {
            const isPro = planId === 'PREMIUM'
            const prices = PLAN_PRICES[planId]
            const features = planFeatures(planId)
            const missingFeatures = planMissing(planId)
            return (
              <div
                key={planId}
                className={cn(
                  'relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-all',
                  isPro
                    ? 'scale-[1.01] border-amber-200 shadow-md'
                    : 'border-slate-200 text-slate-900',
                )}
              >
                <h3 className="text-lg font-bold text-slate-900">
                  {t(`billing.plans.${planId.toLowerCase()}.name`)}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t(`billing.plans.${planId.toLowerCase()}.tagline`)}
                </p>
                <div className="mt-6">
                  <p className="text-3xl font-extrabold text-slate-900">
                    {formatCurrency(prices.price)}
                    <span className="text-base font-medium">{t('billing.perMonth')}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    + {formatCurrency(prices.setup)} {t('billing.setupOnce', { defaultValue: 'setup una tantum' })}
                  </p>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {features.map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', isPro ? 'text-amber-500' : 'text-emerald-500')} />
                      <span>{line}</span>
                    </li>
                  ))}
                  {missingFeatures.map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-400 line-through">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleActivatePlan(planId)}
                  disabled={loadingPlan !== null}
                  className={cn(
                    'mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
                    isPro
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100',
                    loadingPlan !== null && 'cursor-not-allowed opacity-60',
                  )}
                >
                  {loadingPlan === planId ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t('billing.loading')}
                    </>
                  ) : (
                    t('billing.activatePlan', {
                      plan: t(`billing.plans.${planId.toLowerCase()}.name`),
                      defaultValue: 'Attiva {{plan}}',
                    })
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {hasSubscription && (
        <div className="rounded-2xl premium-card px-6 py-6 sm:px-8">
          <p className="text-sm font-medium text-pietra">
            {t('billing.activeServices', {
              plan: t(`billing.plans.${activePlanId.toLowerCase()}.name`),
              defaultValue: 'Servizi attivi per il piano {{plan}}',
            })}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-fumo">
            {planFeatures(activePlanId).map(feature => (
              <li key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ExecutivePageShell>
  )
}
