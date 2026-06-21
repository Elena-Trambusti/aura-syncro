import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { BRAND } from '../lib/brand'
import { ui } from '../lib/ui'
import BrandLogo from '../components/brand/BrandLogo'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { formatApiError } from '../lib/errors'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success(t('auth.welcomeBack'))
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
            <BrandLogo
              size="lg"
              className="mx-auto mb-5 shadow-lg ring-1 ring-slate-900/5"
            />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {BRAND.name}
            </h1>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
              {t('brand.tagline')}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">{t('auth.loginTitle')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('auth.loginSubtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className={ui.label}>
                  {t('common.email')}
                </label>
                <input
                  id="login-email"
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className={ui.label}>
                    {t('common.password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-amber-600 transition-colors hover:text-amber-700"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${ui.input} pr-12`}
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete="current-password"
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
                {loading ? t('auth.loggingIn') : t('auth.login')}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <p className="text-center text-sm text-slate-600">
                {t('auth.newRestaurant')}{' '}
                <Link
                  to="/register"
                  className="font-semibold text-amber-600 transition-colors hover:text-amber-700"
                >
                  {t('auth.register')}
                </Link>
              </p>
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
