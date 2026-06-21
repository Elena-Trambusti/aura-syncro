import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function PaymentCancelPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const returnSlug = params.get('slug')

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center w-full max-w-sm">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">{t('guestCheckout.cancelTitle')}</h1>
        <p className="text-slate-500 mb-8">{t('guestCheckout.cancelDesc')}</p>

        <div className="space-y-3">
          {returnSlug && (
            <Link
              to={`/menu/${returnSlug}`}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-2xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t('guestCheckout.retryOrder')}
            </Link>
          )}
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-slate-200 rounded-2xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('guestCheckout.backHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
