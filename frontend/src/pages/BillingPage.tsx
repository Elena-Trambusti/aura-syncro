import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { formatApiError } from '../lib/errors'
import { BRAND } from '../lib/brand'
import { useAuth } from '../contexts/AuthContext'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'

const SETUP_FEE = 500
const MONTHLY_FEE = 199
const BRAND_LOGO_SRC = '/brand/aura-syncro-logo-tally.svg'

export default function BillingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { restaurant } = useAuth()
  const [loadingPremium, setLoadingPremium] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPremium = restaurant?.hasActiveSubscription === true

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

  const handleActivatePremium = async () => {
    setLoadingPremium(true)
    setError(null)

    try {
      const { data } = await api.post<{ checkoutUrl: string }>('/checkout')
      if (!data.checkoutUrl) {
        throw new Error(t('billing.checkoutUrlMissing'))
      }
      window.location.href = data.checkoutUrl
    } catch (err: unknown) {
      setError(formatApiError(err))
      setLoadingPremium(false)
    }
  }

  const features = [
    t('billing.feature1'),
    t('billing.feature2'),
    t('billing.feature3'),
    t('billing.feature4'),
  ]

  return (
    <ExecutivePageShell className="mx-auto max-w-2xl space-y-8">
      <ExecutivePageHeader
        title={t('billing.pageTitle')}
        subtitle={t('billing.pageSubtitle')}
        meta={(
          <img
            src={BRAND_LOGO_SRC}
            alt={BRAND.name}
            className="mt-4 h-12 w-auto sm:h-14"
          />
        )}
      />

      {hasPremium && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-900">{t('billing.activeBadge')}</p>
        </div>
      )}

      {!hasPremium && (
        <div className="overflow-hidden rounded-2xl premium-card shadow-sm">
          <div className="border-b border-white/[0.06] bg-gradient-to-br from-aura-gold/10 via-navy-elevated to-navy-mid px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-aura-gold/80">
              {t('billing.planBadge')}
            </p>
            <h2 className="mt-2 text-xl font-bold text-pietra">{t('billing.cardTitle')}</h2>
            <p className="mt-1 text-sm text-fumo">{t('billing.cardSubtitle')}</p>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-navy-surface/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-fumo">
                  {t('billing.setupLabel')}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-pietra">
                  {formatCurrency(SETUP_FEE)}
                </p>
                <p className="mt-1 text-xs text-fumo">{t('billing.setupHint')}</p>
              </div>
              <div className="rounded-xl border border-aura-gold/25/60 bg-aura-gold/10/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800/70">
                  {t('billing.subscriptionLabel')}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-pietra">
                  {formatCurrency(MONTHLY_FEE)}
                  <span className="text-base font-semibold text-fumo">/{t('billing.perMonth')}</span>
                </p>
                <p className="mt-1 text-xs text-fumo">{t('billing.subscriptionHint')}</p>
              </div>
            </div>

            <p className="text-center text-sm font-medium text-fumo">{t('billing.summary')}</p>

            <ul className="space-y-3 text-sm text-fumo">
              {features.map(feature => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-800"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleActivatePremium}
              disabled={loadingPremium}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-aura-gold py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-aura-gold-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPremium ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('billing.loading')}
                </>
              ) : (
                t('billing.activateButton')
              )}
            </button>

            <p className="text-center text-xs text-fumo">{t('billing.secureNote')}</p>
          </div>
        </div>
      )}

      {hasPremium && (
        <div className="rounded-2xl premium-card px-6 py-6 sm:px-8">
          <p className="text-sm font-medium text-pietra">{t('billing.allIncludedTitle')}</p>
          <ul className="mt-4 space-y-2 text-sm text-fumo">
            {features.map(feature => (
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
