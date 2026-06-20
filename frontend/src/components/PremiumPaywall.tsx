import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

export default function PremiumPaywall() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{t('paywall.title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('paywall.description')}</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/billing')}
          className="mt-8 w-full rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
        >
          {t('paywall.cta')}
        </button>
      </div>
    </div>
  )
}
