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
  const [restaurantSlug, setRestaurantSlug] = useState('')
  const [tenantOptions, setTenantOptions] = useState<Array<{ name: string; slug: string }>>([])
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password, restaurantSlug || undefined)
      toast.success(t('auth.welcomeBack'))
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { code?: string; restaurants?: Array<{ name: string; slug: string }> } } })?.response?.data
      if (data?.code === 'MULTIPLE_TENANTS' && data.restaurants?.length) {
        setTenantOptions(data.restaurants)
        toast.error(t('auth.multipleTenantsHint'))
      } else {
        toast.error(formatApiError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="aura-auth-shell pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="h-0.5 shrink-0 bg-gradient-to-r from-aura-gold-muted via-aura-gold to-aura-gold-light" aria-hidden />

      <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
          <LanguageSwitcher prominent />
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-6 text-center sm:mb-8">
            <Link to="/" className="inline-block transition-transform hover:scale-105">
              <BrandLogo size="lg" showName layout="horizontal" className="mx-auto mb-5 justify-center" />
            </Link>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-pietra sm:text-3xl">
              {BRAND.name}
            </h1>
            <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-fumo">
              {t('brand.tagline')}
            </p>
          </div>

          <div className="text-left w-full">
            <Link 
              to="/" 
              className="text-white/60 hover:text-amber-500 text-sm transition-colors mb-4 inline-block cursor-pointer"
            >
              &larr; Torna alla home
            </Link>
          </div>

          <div className="aura-auth-card">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-pietra">{t('auth.loginTitle')}</h2>
              <p className="mt-1 text-sm text-fumo">{t('auth.loginSubtitle')}</p>
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

              {(tenantOptions.length > 0 || restaurantSlug) && (
                <div>
                  <label htmlFor="login-restaurant" className={ui.label}>
                    {t('auth.restaurantCode')}
                  </label>
                  {tenantOptions.length > 0 ? (
                    <select
                      id="login-restaurant"
                      value={restaurantSlug}
                      onChange={e => setRestaurantSlug(e.target.value)}
                      className={ui.input}
                      required
                    >
                      <option value="">{t('auth.selectRestaurant')}</option>
                      {tenantOptions.map(r => (
                        <option key={r.slug} value={r.slug}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="login-restaurant"
                      type="text"
                      value={restaurantSlug}
                      onChange={e => setRestaurantSlug(e.target.value)}
                      className={ui.input}
                      placeholder={t('auth.restaurantCodePlaceholder')}
                    />
                  )}
                  <p className="mt-1 text-xs text-fumo">{t('auth.restaurantCodeHint')}</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className={ui.label}>
                    {t('common.password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-aura-gold transition-colors hover:text-aura-gold"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-fumo transition-colors hover:text-fumo"
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

            <div className="mt-6 border-t border-white/[0.06] pt-6">
              <p className="text-center text-sm text-fumo">
                {t('auth.newRestaurant')}{' '}
                <Link
                  to="/register"
                  className="font-semibold text-aura-gold transition-colors hover:text-aura-gold"
                >
                  {t('auth.register')}
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-fumo">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('auth.secureAccess')}
          </p>
          <p className="mt-3 text-center text-xs text-fumo">
            <Link to="/prezzi" className="text-aura-gold hover:underline">Prezzi</Link>
            {' · '}
            <Link to="/privacy" className="text-aura-gold hover:underline">Privacy</Link>
            {' · '}
            <Link to="/termini" className="text-aura-gold hover:underline">Termini</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
