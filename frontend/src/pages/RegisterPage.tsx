import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { BRAND } from '../lib/brand'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    restaurantName: '',
    name: '',
    email: '',
    password: '',
    phone: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register(form)
      toast.success(t('auth.welcome'))
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      toast.error(error.response?.data?.error || t('auth.registerError'))
    } finally {
      setLoading(false)
    }
  }

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))
  const inputClass =
    'w-full px-4 py-2.5 border border-stone-700 rounded-xl bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-stone-600'

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: `linear-gradient(135deg, ${BRAND.dark} 0%, #1c1917 50%, #292524 100%)` }}
    >
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <LanguageSwitcher prominent />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.amber})` }}
          >
            <Sparkles className="w-9 h-9 text-stone-950" />
          </div>
          <h1 className="text-3xl font-bold text-white">{BRAND.name}</h1>
          <p className="text-stone-400 mt-2 text-sm">{t('auth.registerSubtitle')}</p>
        </div>

        <div className="glass-modal p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('auth.restaurantName')}</label>
              <input type="text" value={form.restaurantName} onChange={e => update('restaurantName', e.target.value)} className={inputClass} placeholder={t('auth.restaurantNamePlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('auth.yourName')}</label>
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={inputClass} placeholder={t('auth.yourNamePlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('common.email')}</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputClass} placeholder={t('auth.emailPlaceholderRegister')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('common.phone')}</label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClass} placeholder={t('auth.phonePlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">{t('common.password')}</label>
              <input type="password" value={form.password} onChange={e => update('password', e.target.value)} className={inputClass} placeholder={t('auth.passwordMinLength')} minLength={6} required />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-3 rounded-xl transition-all shadow-md disabled:opacity-60 mt-2 text-stone-950"
              style={{ background: `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.amber})` }}
            >
              {loading ? t('auth.registering') : t('auth.createRestaurant')}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-4">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-medium hover:underline" style={{ color: BRAND.gold }}>
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
