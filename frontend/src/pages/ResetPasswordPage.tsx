import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api'
import { BRAND } from '../lib/brand'
import { ui } from '../lib/ui'
import BrandLogo from '../components/brand/BrandLogo'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { formatApiError } from '../lib/errors'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error(t('auth.resetPasswordInvalidToken'))
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      toast.success(t('auth.resetPasswordSuccess'))
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
              <h2 className="text-lg font-semibold text-slate-900">{t('auth.resetPasswordTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('auth.resetPasswordSubtitle')}</p>
            </div>

            {done ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">{t('auth.resetPasswordSuccess')}</p>
                <Link to="/login" className={`block w-full py-3 text-center ${ui.btnPrimary}`}>
                  {t('auth.login')}
                </Link>
              </div>
            ) : !token ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600">{t('auth.resetPasswordInvalidToken')}</p>
                <Link
                  to="/forgot-password"
                  className="block text-center text-sm font-medium text-amber-600 hover:text-amber-700"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-password" className={ui.label}>
                    {t('auth.newPassword')}
                  </label>
                  <div className="relative">
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`${ui.input} pr-12`}
                      placeholder={t('auth.passwordMinLength')}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 ${ui.btnPrimary} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {loading ? t('common.saving') : t('auth.resetPassword')}
                </button>
              </form>
            )}
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
