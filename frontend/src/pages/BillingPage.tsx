import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Check, Minus, CheckCircle2, XCircle, ExternalLink, Sparkles } from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '../lib/api'
import { formatCurrency, cn } from '../lib/utils'
import { formatApiError } from '../lib/formatApiError'
import { BRAND, BRAND_LOGO_DISPLAY_SRC } from '../lib/brand'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import QueryErrorBanner from '../components/QueryErrorBanner'
import AuraIcon from '../components/ui/AuraIcon'
import {
  LUXURY_CARD_CLASS,
  LUXURY_CTA_CLASS,
  LuxuryCardHoverLine,
} from '../components/landing/landingLuxury'

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

  const { data: restaurantData, isError: restaurantError } = useQuery<{ settings?: { hasStripeBilling?: boolean } | null }>({
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
      setError(formatApiError(t, err))
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
      setError(formatApiError(t, err))
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
            src={BRAND_LOGO_DISPLAY_SRC}
            alt={BRAND.name}
            className="mt-4 h-12 w-auto sm:h-14"
          />
        )}
      />

      {restaurantError && <QueryErrorBanner />}

      {hasSubscription && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-200">
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-navy-surface/60 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/10 disabled:opacity-60"
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
          className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!hasSubscription && (
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          {PLAN_IDS.map(planId => {
            const isPro = planId === 'PREMIUM'
            const prices = PLAN_PRICES[planId]
            const features = planFeatures(planId)
            const missingFeatures = planMissing(planId)
            return (
              <article
                key={planId}
                className={cn(
                  LUXURY_CARD_CLASS,
                  'p-8 sm:p-9',
                  isPro && '!overflow-visible ring-1 ring-[#D4AF37]/25',
                )}
              >
                {isPro ? (
                  <span className="absolute -top-3.5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D4AF37]/35 bg-[#0f0c08] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8C872] shadow-[0_0_24px_rgba(212,175,55,0.2)]">
                    <AuraIcon icon={Sparkles} size="sm" className="text-[#E8C872]" />
                    {t('landing.pricing.pro.badge', { defaultValue: 'Consigliato' })}
                  </span>
                ) : null}

                <h3 className="font-display text-2xl font-medium tracking-tight text-[#F0E6D2]">
                  {t(`billing.plans.${planId.toLowerCase()}.name`)}
                </h3>
                <p className="mt-2 text-sm font-light leading-relaxed text-[#F0E6D2]/70">
                  {t(`billing.plans.${planId.toLowerCase()}.tagline`)}
                </p>

                <div className="mt-8 border-b border-[#D4AF37]/10 pb-8">
                  <p className="lux-heading font-display text-3xl font-medium tracking-tight sm:text-4xl">
                    {formatCurrency(prices.price)}
                    <span className="text-base font-medium text-[#F0E6D2]/80">{t('billing.perMonth')}</span>
                  </p>
                  <p className="mt-2 text-sm font-light text-[#F0E6D2]/65">
                    + {formatCurrency(prices.setup)} {t('billing.setupOnce', { defaultValue: 'setup una tantum' })}
                  </p>
                </div>

                <ul className="mt-8 flex-1 space-y-3.5">
                  {features.map(line => (
                    <li key={line} className="flex items-start gap-3 text-sm font-light text-[#F0E6D2]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/25 bg-black/40">
                        <AuraIcon icon={Check} size="sm" weight="display" className="text-[#E8C872]" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                  {missingFeatures.map(line => (
                    <li key={line} className="flex items-start gap-3 text-sm font-light text-[#F0E6D2]/35">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#F0E6D2]/10 bg-black/20">
                        <AuraIcon icon={Minus} size="sm" weight="display" className="text-[#F0E6D2]/30" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleActivatePlan(planId)}
                  disabled={loadingPlan !== null}
                  className={cn(
                    'mt-8 flex w-full items-center justify-center gap-2 transition-all',
                    isPro
                      ? LUXURY_CTA_CLASS
                      : 'aura-btn-ghost py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#F0E6D2]',
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

                <LuxuryCardHoverLine />
              </article>
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
