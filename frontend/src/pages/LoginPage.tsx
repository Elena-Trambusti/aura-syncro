import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { BRAND } from '../lib/brand'
import { formatApiError } from '../lib/errors'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [email, setEmail] = useState('admin@demo.it')
  const [password, setPassword] = useState('admin123')
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
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6"
      style={{ background: `linear-gradient(135deg, ${BRAND.dark} 0%, #1c1917 50%, #292524 100%)` }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: BRAND.gold }} />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: BRAND.amber }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.amber})`, boxShadow: `0 8px 32px ${BRAND.gold}40` }}
          >
            <Sparkles className="w-9 h-9 text-stone-950" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{BRAND.name}</h1>
          <p className="text-stone-400 mt-2 text-sm">{t('brand.tagline')}</p>
        </div>

        <div className="rounded-2xl p-8 shadow-2xl border border-stone-800 bg-stone-900/80 backdrop-blur-xl">
          <h2 className="text-xl font-bold text-stone-100 mb-6">{t('auth.loginTitle')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('common.email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-700 rounded-xl bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-stone-600"
                style={{ ['--tw-ring-color' as string]: BRAND.gold }}
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('common.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-700 rounded-xl bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60 pr-12 placeholder:text-stone-600"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-3 rounded-xl transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-stone-950 hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.amber})` }}
            >
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-xl border border-amber-900/40 bg-amber-950/30">
            <p className="text-xs font-medium mb-1" style={{ color: BRAND.amber }}>{t('auth.demoCredentials')}</p>
            <p className="text-xs text-stone-400">{t('auth.demoHint')}</p>
          </div>

          <p className="text-center text-sm text-stone-500 mt-4">
            {t('auth.newRestaurant')}{' '}
            <Link to="/register" className="font-medium hover:underline" style={{ color: BRAND.gold }}>
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
