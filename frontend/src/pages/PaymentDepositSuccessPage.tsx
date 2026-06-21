import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { CheckCircle2, CalendarCheck, Loader2 } from 'lucide-react'

interface DepositSessionData {
  status: string
  amount: number
  customerEmail?: string
  reservation?: {
    guestName: string
    covers: number
    date: string
    restaurantName: string
    restaurantSlug?: string
  }
}

export default function PaymentDepositSuccessPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const [data, setData] = useState<DepositSessionData | null>(null)
  const [loading, setLoading] = useState(!!sessionId)
  const [error, setError] = useState(!sessionId)

  useEffect(() => {
    if (!sessionId) return
    api.get(`/payments/deposit-session/${sessionId}`)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <p className="text-slate-500">{t('depositSuccess.verifying')}</p>
        </div>
      </div>
    )
  }

  const backLink = data?.reservation?.restaurantSlug
    ? `/menu/${data.reservation.restaurantSlug}`
    : null

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">{t('depositSuccess.errorTitle')}</h2>
          <p className="text-slate-500 mb-6">{t('depositSuccess.errorDesc')}</p>
          {backLink
            ? <Link to={backLink} className="text-amber-600 font-semibold hover:underline">{t('depositSuccess.backToMenu')}</Link>
            : <span className="text-slate-500 text-sm">{t('depositSuccess.contactRestaurant')}</span>}
        </div>
      </div>
    )
  }

  const isPaid = data.status === 'paid'

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto">
      <div className={`px-5 pt-10 pb-8 text-white text-center ${isPaid ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          {isPaid ? <CheckCircle2 className="w-10 h-10 text-white" /> : <CalendarCheck className="w-10 h-10 text-white" />}
        </div>
        <h1 className="text-2xl font-black mb-1">
          {isPaid ? t('depositSuccess.confirmedTitle') : t('depositSuccess.processingTitle')}
        </h1>
        <p className="text-white/80 text-sm">
          {isPaid ? t('depositSuccess.confirmedSubtitle') : t('depositSuccess.processingSubtitle')}
        </p>
        {data.amount > 0 && (
          <div className="mt-4 bg-white/20 rounded-2xl px-6 py-3 inline-block">
            <span className="text-3xl font-black">{formatCurrency(data.amount)}</span>
          </div>
        )}
      </div>

      {data.reservation && (
        <div className="px-5 py-6 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-2 text-sm text-slate-700">
            <p><strong>{data.reservation.restaurantName}</strong></p>
            <p>{t('depositSuccess.guest', { name: data.reservation.guestName })}</p>
            <p>{t('depositSuccess.covers', { count: data.reservation.covers })}</p>
            <p>{t('depositSuccess.date', { date: new Date(data.reservation.date).toLocaleDateString() })}</p>
          </div>
          {data.customerEmail && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              {t('depositSuccess.receiptSent', { email: data.customerEmail })}
            </p>
          )}
        </div>
      )}

      <div className="px-5 pb-8">
        {backLink ? (
          <Link
            to={backLink}
            className="flex items-center justify-center w-full py-3.5 border-2 border-slate-200 rounded-2xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
          >
            {t('depositSuccess.backToMenu')}
          </Link>
        ) : (
          <p className="text-center text-sm text-slate-500">{t('depositSuccess.contactRestaurant')}</p>
        )}
      </div>
    </div>
  )
}
