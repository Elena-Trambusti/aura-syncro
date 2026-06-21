import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { BRAND } from '../lib/brand'
import { ui } from '../lib/ui'
import BrandLogo from '../components/brand/BrandLogo'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { formatApiError } from '../lib/errors'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
      toast.success(t('auth.forgotPasswordSent'))
    } catch (err: unknown) {
      toast.error(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-amber-50/80 via-slate-50 to-slate-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="h-1 shrink-0 bg-gradient-to-r from-amber-600 via-[#C9A227] to-amber-500" aria-hidden />

      <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
          <LanguageSwitcher prominent />
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-6 text-center sm:mb-8">
            <BrandLogo size="lg" className="mx-auto mb-5 shadow-lg ring-1 ring-slate-900/5" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{BRAND.name}</h1>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">{t('auth.forgotPasswordTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('auth.forgotPasswordSubtitle')}</p>
            </div>

            {sent ? (
              <p className="text-sm text-slate-600">{t('auth.forgotPasswordSent')}</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className={ui.label}>
                    {t('common.email')}
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={ui.input}
                    placeholder={t('auth.emailPlaceholder')}
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 ${ui.btnPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {loading ? t('common.saving') : t('auth.forgotPassword')}
                </button>
              </form>
            )}

            <div className="mt-6 border-t border-slate-100 pt-6">
              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-sm font-medium text-amber-600 transition-colors hover:text-amber-700"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('auth.backToLogin')}
              </Link>
            </div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('auth.secureAccess')}
          </p>
        </div>
      </div>
    </div>
  )
}
