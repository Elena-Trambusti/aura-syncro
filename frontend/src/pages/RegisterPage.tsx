import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { countryCodeFromTaxRegion, type TaxRegion } from '../lib/fiscalRegime'
import { BRAND } from '../lib/brand'
import { ui } from '../lib/ui'
import BrandLogo from '../components/brand/BrandLogo'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import toast from 'react-hot-toast'
import { formatApiError } from '../lib/errors'

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
    taxRegion: 'IT_MAIN' as TaxRegion,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register({
        ...form,
        countryCode: countryCodeFromTaxRegion(form.taxRegion),
      })
      toast.success(t('auth.welcome'))
    } catch (err: unknown) {
      toast.error(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const onFiscalLocationChange = (taxRegion: TaxRegion) => {
    setForm(f => ({ ...f, taxRegion }))
  }

  return (
    <div className="min-h-screen aura-auth-shell flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <LanguageSwitcher prominent />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo size="lg" className="mx-auto mb-4 shadow-sm border border-aura-gold/25" />
          <h1 className="text-3xl font-bold text-pietra">{BRAND.name}</h1>
          <p className="text-fumo mt-2 text-sm">{t('auth.registerSubtitle')}</p>
        </div>

        <div className="aura-auth-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={ui.label}>{t('auth.restaurantName')}</label>
              <input type="text" value={form.restaurantName} onChange={e => update('restaurantName', e.target.value)} className={ui.input} placeholder={t('auth.restaurantNamePlaceholder')} required />
            </div>
            <div>
              <label className={ui.label}>{t('auth.country')}</label>
              <select
                value={form.taxRegion}
                onChange={e => onFiscalLocationChange(e.target.value as TaxRegion)}
                className={ui.input}
              >
                <option value="IT_MAIN">{t('auth.countryIT')}</option>
                <option value="ES_PENINSULA">{t('auth.taxRegionPeninsula')}</option>
                <option value="ES_CANARIAS">{t('auth.taxRegionCanarias')}</option>
              </select>
              <p className="mt-1.5 text-xs text-fumo">{t('auth.fiscalLocationHint')}</p>
            </div>
            <div>
              <label className={ui.label}>{t('auth.yourName')}</label>
              <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className={ui.input} placeholder={t('auth.yourNamePlaceholder')} required />
            </div>
            <div>
              <label className={ui.label}>{t('common.email')}</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={ui.input} placeholder={t('auth.emailPlaceholderRegister')} required />
            </div>
            <div>
              <label className={ui.label}>{t('common.phone')}</label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={ui.input} placeholder={t('auth.phonePlaceholder')} />
            </div>
            <div>
              <label className={ui.label}>{t('common.password')}</label>
              <input type="password" value={form.password} onChange={e => update('password', e.target.value)} className={ui.input} placeholder={t('auth.passwordMinLength')} minLength={8} required />
            </div>

            <div className="flex items-start gap-3 pt-2 pb-1">
              <input 
                type="checkbox" 
                id="legalAccept" 
                required 
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border border-white/20 bg-black/50 text-aura-gold focus:ring-1 focus:ring-aura-gold focus:ring-offset-0 focus:ring-offset-transparent"
              />
              <label htmlFor="legalAccept" className="text-xs text-slate-400 leading-relaxed cursor-pointer select-none">
                Dichiaro di aver letto e accettato i <Link to="/termini" className="text-aura-gold hover:underline" target="_blank">Termini di Servizio</Link>, la <Link to="/privacy" className="text-aura-gold hover:underline" target="_blank">Privacy Policy</Link>, la <Link to="/cookie" className="text-aura-gold hover:underline" target="_blank">Cookie Policy</Link> e il <Link to="/dpa" className="text-aura-gold hover:underline" target="_blank">DPA</Link> per la gestione dei dati dei miei clienti.
              </label>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 mt-2 ${ui.btnPrimary} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {loading ? t('auth.registering') : t('auth.createRestaurant')}
            </button>
          </form>

          <p className="text-center text-sm text-fumo mt-4">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-medium text-aura-gold hover:text-aura-gold hover:underline">
              {t('auth.login')}
            </Link>
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
