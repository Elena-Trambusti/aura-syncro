import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { CheckCircle2, CalendarCheck, Loader2 } from 'lucide-react'

interface DepositSessionData {
  status: string
  amount: number
  fundsCaptured?: boolean
  guaranteeAmount?: number
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
  const receiptToken = params.get('receipt_token')
  const [data, setData] = useState<DepositSessionData | null>(null)
  const [loading, setLoading] = useState(() => !!(sessionId && receiptToken))
  const [error, setError] = useState(!sessionId || !receiptToken)

  useEffect(() => {
    if (!sessionId || !receiptToken) {
      setLoading(false)
      return
    }
    api.get(`/payments/deposit-session/${sessionId}`, { params: { receipt_token: receiptToken } })
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [sessionId, receiptToken])

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-aura-gold animate-spin" />
          <p className="text-fumo">{t('depositSuccess.verifying')}</p>
        </div>
      </div>
    )
  }

  const backLink = data?.reservation?.restaurantSlug
    ? `/menu/${data.reservation.restaurantSlug}`
    : null

  if (error || !data) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h2 className="text-xl font-bold text-pietra mb-2">{t('depositSuccess.errorTitle')}</h2>
          <p className="text-fumo mb-6">{t('depositSuccess.errorDesc')}</p>
          {backLink
            ? <Link to={backLink} className="text-aura-gold font-semibold hover:underline">{t('depositSuccess.backToMenu')}</Link>
            : <span className="text-fumo text-sm">{t('depositSuccess.contactRestaurant')}</span>}
        </div>
      </div>
    )
  }

  const isPaid = data.status === 'paid'
  const isCardOnFile = data.status === 'no_payment_required' || data.fundsCaptured === false

  return (
    <div className="min-h-screen bg-navy max-w-lg mx-auto">
      <div className={`px-5 pt-10 pb-8 text-white text-center ${isPaid ? 'bg-gradient-to-br from-emerald-900/80 to-emerald-950' : 'bg-gradient-to-br from-aura-gold/20 to-navy-surface'}`}>
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-premium-sm">
          {isPaid || isCardOnFile ? <CheckCircle2 className="w-10 h-10 text-emerald-400" /> : <CalendarCheck className="w-10 h-10 text-aura-gold" />}
        </div>
        <h1 className="text-2xl font-black mb-1 text-pietra">
          {isPaid ? t('depositSuccess.confirmedTitle') : isCardOnFile ? t('depositSuccess.cardSavedTitle', { defaultValue: 'Carta salvata a garanzia' }) : t('depositSuccess.processingTitle')}
        </h1>
        <p className="text-fumo text-sm">
          {isPaid ? t('depositSuccess.confirmedSubtitle') : isCardOnFile ? t('depositSuccess.cardSavedSubtitle', { defaultValue: 'La caparra verrà addebitata solo in caso di no-show.' }) : t('depositSuccess.processingSubtitle')}
        </p>
        {(data.amount > 0 || (data.guaranteeAmount ?? 0) > 0) && (
          <div className="mt-4 bg-white/5 rounded-2xl px-6 py-3 inline-block border border-white/10">
            <span className="text-3xl font-black text-pietra">{formatCurrency(isPaid ? data.amount : (data.guaranteeAmount ?? data.amount))}</span>
            {isCardOnFile && !isPaid && (
              <p className="text-xs text-fumo mt-1">{t('depositSuccess.guaranteeHint', { defaultValue: 'Importo garanzia — non ancora addebitato' })}</p>
            )}
          </div>
        )}
      </div>

      {data.reservation && (
        <div className="px-5 py-6 space-y-4">
          <div className="premium-card p-5 space-y-2 text-sm text-fumo">
            <p><strong className="text-pietra">{data.reservation.restaurantName}</strong></p>
            <p>{t('depositSuccess.guest', { name: data.reservation.guestName })}</p>
            <p>{t('depositSuccess.covers', { count: data.reservation.covers })}</p>
            <p>{t('depositSuccess.date', { date: new Date(data.reservation.date).toLocaleDateString() })}</p>
          </div>
          {data.customerEmail && (
            <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
              {t('depositSuccess.receiptSent', { email: data.customerEmail })}
            </p>
          )}
        </div>
      )}

      <div className="px-5 pb-8">
        {backLink ? (
          <Link
            to={backLink}
            className="flex items-center justify-center w-full py-3.5 border border-white/10 rounded-xl text-fumo font-semibold hover:bg-white/5 hover:text-pietra transition-colors"
          >
            {t('depositSuccess.backToMenu')}
          </Link>
        ) : (
          <p className="text-center text-sm text-fumo">{t('depositSuccess.contactRestaurant')}</p>
        )}
      </div>
    </div>
  )
}
