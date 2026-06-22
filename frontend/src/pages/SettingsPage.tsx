import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import type { CountryCode, TaxRegion } from '../lib/fiscalRegime'
import { Save, QrCode, ExternalLink, MonitorCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { formatApiError } from '../lib/errors'
import toast from 'react-hot-toast'
import QueryErrorBanner from '../components/QueryErrorBanner'

interface RestaurantSettings {
  countryCode?: CountryCode
  taxRegion?: TaxRegion
  taxRate?: number
  taxId?: string | null
  defaultLocale?: string
}

interface RestaurantData {
  id: string
  slug: string
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  description?: string | null
  settings?: RestaurantSettings | null
}

type SettingsForm = {
  name: string
  address: string
  phone: string
  email: string
  description: string
  countryCode: CountryCode
  taxRegion: TaxRegion
  taxRate: number
  taxId: string
}

function buildSavePayload(data: SettingsForm) {
  const emptyToNull = (v: string) => v.trim() || null
  return {
    name: data.name.trim(),
    address: emptyToNull(data.address),
    phone: emptyToNull(data.phone),
    email: emptyToNull(data.email),
    description: emptyToNull(data.description),
    settings: {
      countryCode: data.countryCode,
      taxRegion: data.taxRegion,
      taxRate: data.taxRate,
      taxId: emptyToNull(data.taxId),
    },
  }
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { restaurant, refreshRestaurant } = useAuth()
  const tk = useTenantQueryKey()
  const queryClient = useQueryClient()

  const { data: restaurantData, isError } = useQuery<RestaurantData>({
    queryKey: tq(tk, 'restaurant'),
    queryFn: () => api.get('/restaurant').then(r => r.data),
  })

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
    countryCode: 'IT' as CountryCode,
    taxRegion: 'IT_MAIN' as TaxRegion,
    taxRate: 10,
    taxId: '',
  })

  useEffect(() => {
    if (!restaurantData) return
    setForm({
      name: restaurantData.name || restaurant?.name || '',
      address: restaurantData.address || '',
      phone: restaurantData.phone || '',
      email: restaurantData.email || '',
      description: restaurantData.description || '',
      countryCode: restaurantData.settings?.countryCode || 'IT',
      taxRegion: restaurantData.settings?.taxRegion || 'IT_MAIN',
      taxRate: restaurantData.settings?.taxRate ?? 10,
      taxId: restaurantData.settings?.taxId || '',
    })
  }, [restaurantData, restaurant?.name])

  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const onCountryChange = (countryCode: CountryCode) => {
    setForm(f => ({
      ...f,
      countryCode,
      taxRegion: countryCode === 'ES'
        ? (f.taxRegion.startsWith('ES_') ? f.taxRegion : 'ES_CANARIAS')
        : 'IT_MAIN',
    }))
  }

  const save = useMutation({
    mutationFn: (data: typeof form) => api.put('/restaurant', buildSavePayload(data)),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'restaurant') })
      await refreshRestaurant()
      toast.success(t('settings.saved'))
    },
    onError: (err: unknown) => {
      toast.error(formatApiError(err))
    },
  })

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t('settings.nameRequired'))
      return
    }
    save.mutate(form)
  }

  const menuUrl = `${window.location.origin}/menu/${restaurant?.slug}`
  const kitchenUrl = `${window.location.origin}/cucina`

  return (
    <div className="space-y-6 max-w-2xl">
      {isError && <QueryErrorBanner />}
      <div>
        <h1 className="aura-page-title">{t('settings.title')}</h1>
        <p className="aura-page-subtitle">{t('settings.subtitle')}</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">{t('common.language')}</h2>
        <p className="text-sm text-slate-500 mb-4">{t('common.languageDescription')}</p>
        <LanguageSwitcher />
      </div>

      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">{t('settings.fiscalTitle')}</h2>
        <p className="text-sm text-slate-500 mb-4">{t('settings.fiscalDesc')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.country')}</label>
            <select
              value={form.countryCode}
              onChange={e => onCountryChange(e.target.value as CountryCode)}
              className="w-full px-4 py-2.5 saas-input"
            >
              <option value="IT">{t('auth.countryIT')}</option>
              <option value="ES">{t('auth.countryES')}</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.taxRegion')}</label>
            <select
              value={form.taxRegion}
              onChange={e => update('taxRegion', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            >
              {form.countryCode === 'IT' ? (
                <option value="IT_MAIN">{t('settings.taxRegionIT_MAIN')}</option>
              ) : (
                <>
                  <option value="ES_CANARIAS">{t('settings.taxRegionES_CANARIAS')}</option>
                  <option value="ES_PENINSULA">{t('settings.taxRegionES_PENINSULA')}</option>
                </>
              )}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.taxRate')}</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.taxRate}
              onChange={e => update('taxRate', parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.taxId')}</label>
            <input
              value={form.taxId}
              onChange={e => update('taxId', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">{t('settings.saveHint')}</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">{t('settings.restaurantInfo')}</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.restaurantName')}</label>
              <input value={form.name} onChange={e => update('name', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('common.phone')}</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('common.email')}</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('settings.address')}</label>
              <input value={form.address} onChange={e => update('address', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('common.description')}</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none"
                rows={3} />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">{t('settings.qrMenu')}</h2>
        <p className="text-sm text-slate-500 mb-4">{t('settings.qrMenuDesc')}</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">{t('settings.publicMenuLink')}</p>
            <code className="text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 block break-all">{menuUrl}</code>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/qr-builder"
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <QrCode className="w-4 h-4" />
              {t('nav.qrMenu')}
            </Link>
            <button onClick={() => window.open(menuUrl, '_blank')}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors">
              <ExternalLink className="w-4 h-4" />
              {t('settings.openMenu')}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">{t('settings.kds')}</h2>
        <p className="text-sm text-slate-500 mb-4">{t('settings.kdsDesc')}</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-slate-100 px-3 py-2 rounded-lg text-slate-800 break-all">{kitchenUrl}</code>
          <button
            onClick={() => window.open(kitchenUrl, '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <MonitorCheck className="w-4 h-4" />
            {t('common.open')}
          </button>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3">{t('settings.accountInfo')}</h2>
        <div className="space-y-2">
          {[
            { label: t('settings.restaurantId'), value: restaurantData?.id || '—' },
            { label: t('settings.slug'), value: restaurantData?.slug || '—' },
            { label: t('settings.country'), value: form.countryCode },
            { label: t('settings.taxRegion'), value: form.taxRegion },
            { label: t('settings.appVersion'), value: '1.0.0 MVP' },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-slate-200">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className="text-sm font-medium text-slate-700 font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-4 z-20">
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {save.isPending ? t('common.saving') : t('settings.saveChanges')}
        </button>
      </div>
    </div>
  )
}
