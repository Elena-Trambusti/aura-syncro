import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { BRAND } from '../lib/brand'
import { useAuth } from '../contexts/AuthContext'

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
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err instanceof Error ? err.message : t('billing.checkoutError'))
      setError(message)
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
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <img
          src={BRAND_LOGO_SRC}
          alt={BRAND.name}
          className="mx-auto mb-6 h-12 w-auto sm:h-14"
        />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t('billing.pageTitle')}
        </h1>
        <p className="mt-2 mx-auto max-w-lg text-sm leading-relaxed text-slate-500 sm:text-base">
          {t('billing.pageSubtitle')}
        </p>
      </div>

      {hasPremium && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-900">{t('billing.activeBadge')}</p>
        </div>
      )}

      {!hasPremium && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-amber-50/80 via-white to-slate-50 px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700/80">
              {t('billing.planBadge')}
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{t('billing.cardTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('billing.cardSubtitle')}</p>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t('billing.setupLabel')}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {formatCurrency(SETUP_FEE)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{t('billing.setupHint')}</p>
              </div>
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800/70">
                  {t('billing.subscriptionLabel')}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {formatCurrency(MONTHLY_FEE)}
                  <span className="text-base font-semibold text-slate-500">/{t('billing.perMonth')}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{t('billing.subscriptionHint')}</p>
              </div>
            </div>

            <p className="text-center text-sm font-medium text-slate-700">{t('billing.summary')}</p>

            <ul className="space-y-3 text-sm text-slate-600">
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
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleActivatePremium}
              disabled={loadingPremium}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
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

            <p className="text-center text-xs text-slate-400">{t('billing.secureNote')}</p>
          </div>
        </div>
      )}

      {hasPremium && (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6 sm:px-8">
          <p className="text-sm font-medium text-slate-900">{t('billing.allIncludedTitle')}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            {features.map(feature => (
              <li key={feature} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
