import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { api } from '../lib/api'
import { formatCurrency, cn } from '../lib/utils'
import { formatApiError } from '../lib/errors'
import { BRAND } from '../lib/brand'
import { useAuth } from '../contexts/AuthContext'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'

const BRAND_LOGO_SRC = '/brand/aura-syncro-logo-tally.svg'

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Per piccoli locali o food truck.',
    price: 99,
    setup: 250,
    features: [
      'Gestione fino a 12 tavoli',
      '1 singola area (Sala)',
      'Menu QR digitale',
      'Pagamenti Stripe integrati',
    ],
    missingFeatures: [
      'AI Predittiva e Analytics',
      'Gestione Turni e Scorte',
    ]
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    tagline: 'Per ristoranti che esigono il massimo.',
    price: 199,
    setup: 500,
    features: [
      'Aree e tavoli illimitati',
      'AI Predittiva e Analytics',
      'Onboarding chiavi in mano',
      'Gestione Turni e Scorte',
      'Marketing Automation'
    ],
    missingFeatures: []
  }
] as const

export default function BillingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { restaurant } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasSubscription = restaurant?.hasActiveSubscription === true
  const activePlanId = restaurant?.subscriptionPlan || 'STARTER'

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success(t('billing.checkoutSuccess', { defaultValue: 'Abbonamento attivato con successo!' }))
      setSearchParams({}, { replace: true })
    }
    if (searchParams.get('canceled') === 'true') {
      toast(t('billing.checkoutCanceled', { defaultValue: 'Checkout annullato.' }), { icon: 'ℹ️' })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, t])

  const handleActivatePlan = async (planId: string) => {
    setLoadingPlan(planId)
    setError(null)

    try {
      const { data } = await api.post<{ checkoutUrl: string }>('/checkout', { plan: planId })
      if (!data.checkoutUrl) {
        throw new Error(t('billing.checkoutUrlMissing', { defaultValue: 'URL di checkout mancante.' }))
      }
      window.location.href = data.checkoutUrl
    } catch (err: unknown) {
      setError(formatApiError(err))
      setLoadingPlan(null)
    }
  }

  return (
    <ExecutivePageShell className="mx-auto max-w-5xl space-y-8">
      <ExecutivePageHeader
        title="Piani e Fatturazione"
        subtitle="Gestisci il tuo abbonamento ad Aura Syncro"
        meta={(
          <img
            src={BRAND_LOGO_SRC}
            alt={BRAND.name}
            className="mt-4 h-12 w-auto sm:h-14"
          />
        )}
      />

      {hasSubscription && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-900">
            Abbonamento attivo: <strong className="font-bold">{activePlanId === 'PREMIUM' ? 'Premium' : 'Starter'}</strong>
          </p>
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
          {PLANS.map(plan => {
            const isPro = plan.id === 'PREMIUM'
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-8 shadow-sm transition-all',
                  isPro
                    ? 'scale-[1.01] border-white/[0.08] bg-white/[0.02] backdrop-blur-xl text-slate-100 shadow-[0_8_32px_0_rgba(0,0,0,0.37)] hover:border-amber-500/40'
                    : 'border-white/5 bg-slate-900/50 backdrop-blur-sm text-slate-100'
                )}
              >
                <h3 className={cn('text-lg font-bold', isPro ? 'text-white' : 'text-slate-200')}>
                  {plan.name}
                </h3>
                <p className={cn('mt-1 text-sm', isPro ? 'text-slate-300' : 'text-slate-400')}>
                  {plan.tagline}
                </p>
                <div className="mt-6">
                  <p className={cn('text-3xl font-extrabold', isPro ? 'text-white' : 'text-slate-200')}>
                    {formatCurrency(plan.price)}
                    <span className="text-base font-medium">/mese</span>
                  </p>
                  <p className={cn('mt-1 text-sm', isPro ? 'text-slate-300' : 'text-slate-400')}>
                    + {formatCurrency(plan.setup)} setup una tantum
                  </p>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map(line => (
                    <li key={line} className={cn('flex items-start gap-2 text-sm', isPro ? 'text-slate-200' : 'text-slate-300')}>
                      <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', isPro ? 'text-amber-300' : 'text-emerald-500')} />
                      <span>{line}</span>
                    </li>
                  ))}
                  {plan.missingFeatures.map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-500/60 line-through">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-600/50" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleActivatePlan(plan.id)}
                  disabled={loadingPlan !== null}
                  className={cn(
                    'mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
                    isPro
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)]'
                      : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
                    loadingPlan !== null && 'cursor-not-allowed opacity-60'
                  )}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Elaborazione...
                    </>
                  ) : (
                    'Attiva ' + plan.name
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {hasSubscription && (
        <div className="rounded-2xl premium-card px-6 py-6 sm:px-8">
          <p className="text-sm font-medium text-pietra">Servizi attivi per il piano {activePlanId === 'PREMIUM' ? 'Premium' : 'Starter'}</p>
          <ul className="mt-4 space-y-2 text-sm text-fumo">
            {PLANS.find(p => p.id === activePlanId)?.features.map(feature => (
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
