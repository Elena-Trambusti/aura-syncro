import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { lineGrossMoney } from '../lib/money'
import { CheckCircle2, ChefHat, ArrowLeft, Loader2 } from 'lucide-react'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  menuItem: { name: string }
}

interface SessionData {
  status: string
  amount: number
  customerEmail?: string
  order?: {
    id: string
    total: number
    type: string
    table?: { number: number }
    items: OrderItem[]
  }
}

export default function PaymentSuccessPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const orderId = params.get('order_id')
  const receiptToken = params.get('receipt_token')
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(() => !!(sessionId && orderId && receiptToken))
  const [error, setError] = useState(!sessionId || !orderId || !receiptToken)

  useEffect(() => {
    if (!sessionId || !orderId || !receiptToken) {
      setLoading(false)
      return
    }
    api.get(`/payments/session/${sessionId}`, { params: { orderId, receipt_token: receiptToken } })
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [sessionId, orderId, receiptToken])

  if (loading) return (
    <div className="aura-auth-shell flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-aura-gold" />
        <p className="text-fumo">{t('guestCheckout.verifying')}</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="aura-auth-shell flex min-h-screen items-center justify-center p-6">
      <div className="premium-card max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <span className="text-3xl text-red-400">✗</span>
        </div>
        <h2 className="mb-2 text-xl font-bold text-pietra">{t('guestCheckout.errorTitle')}</h2>
        <p className="mb-6 text-fumo">{t('guestCheckout.errorDesc')}</p>
        <Link to="/" className="font-semibold text-aura-gold hover:text-aura-gold-light">{t('guestCheckout.backToMenu')}</Link>
      </div>
    </div>
  )

  const isPaid = data.status === 'paid'

  return (
    <div className="aura-auth-shell mx-auto min-h-screen max-w-lg">
      <div className={`px-5 pt-10 pb-8 text-white text-center ${isPaid ? 'bg-gradient-to-br from-emerald-900/80 to-emerald-950' : 'bg-gradient-to-br from-aura-gold/20 to-navy-surface'}`}>
        <div className="w-20 h-20 bg-white/5 border border-white/10 shadow-premium-sm rounded-full flex items-center justify-center mx-auto mb-4">
          {isPaid
            ? <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            : <ChefHat className="w-10 h-10 text-aura-gold" />
          }
        </div>
        <h1 className="text-2xl font-black mb-1 text-pietra">
          {isPaid ? t('guestCheckout.confirmedTitle') : t('guestCheckout.processingTitle')}
        </h1>
        <p className="text-fumo text-sm">
          {isPaid ? t('guestCheckout.confirmedSubtitle') : t('guestCheckout.processingSubtitle')}
        </p>
        {data.amount > 0 && (
          <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-3 inline-block">
            <span className="text-3xl font-black text-pietra">{formatCurrency(data.amount)}</span>
          </div>
        )}
      </div>

      {data.order && (
        <div className="px-5 py-6 space-y-4">
          <div className="premium-card p-5">
            <h2 className="text-sm font-bold text-fumo uppercase tracking-wide mb-4">{t('guestCheckout.orderSummary')}</h2>
            <div className="space-y-2.5">
              {data.order.items.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aura-gold/15 text-xs font-bold text-aura-gold">
                      {item.quantity}
                    </span>
                    <span className="text-sm text-fumo">{item.menuItem.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-pietra">
                    {formatCurrency(lineGrossMoney(item.quantity, item.unitPrice))}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/[0.06] mt-4 pt-3 flex justify-between">
              <span className="font-bold text-pietra">{t('guestCheckout.totalPaid')}</span>
              <span className="font-black text-emerald-400 text-lg">{formatCurrency(data.order.total)}</span>
            </div>
          </div>

          {data.order.table && (
            <div className="premium-card flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-gold/15">
                <span className="text-lg font-black text-aura-gold">{data.order.table.number}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-fumo">{t('guestCheckout.table', { number: data.order.table.number })}</p>
                <p className="text-xs text-fumo">{t('guestCheckout.tableHint')}</p>
              </div>
            </div>
          )}

          {data.customerEmail && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-400">
              {t('guestCheckout.receiptSent', { email: data.customerEmail })}
            </div>
          )}

          <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-400">
            <p className="font-semibold mb-1">{t('guestCheckout.kitchenNoteTitle')}</p>
            <p>{t('guestCheckout.kitchenNoteDesc')}</p>
          </div>
        </div>
      )}

      <div className="px-5 pb-8">
        <Link
          to="/"
          className="aura-btn-ghost flex w-full items-center justify-center gap-2 py-3.5 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('guestCheckout.backHome')}
        </Link>
      </div>
    </div>
  )
}
