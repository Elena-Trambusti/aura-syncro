import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'

const SETUP_FEE = 500
const MONTHLY_FEE = 199

export default function BillingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleActivate = async () => {
    setLoading(true)
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
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('billing.pageTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('billing.pageSubtitle')}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('billing.cardTitle')}</h2>
            <p className="text-sm text-slate-500">{t('billing.cardSubtitle')}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">{t('billing.setupLine')}</span>
            <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(SETUP_FEE)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">{t('billing.subscriptionLine')}</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatCurrency(MONTHLY_FEE)}/{t('billing.perMonth')}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold text-slate-900">{t('billing.summary')}</p>
            <p className="mt-1 text-xs text-slate-500">{t('billing.summaryHint')}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {t('billing.feature1')}
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {t('billing.feature2')}
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {t('billing.feature3')}
          </li>
        </ul>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleActivate}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('billing.loading')}
            </>
          ) : (
            t('billing.activateButton')
          )}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">{t('billing.secureNote')}</p>
      </div>
    </div>
  )
}
