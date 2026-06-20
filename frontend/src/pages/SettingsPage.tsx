import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Save, QrCode, ExternalLink, MonitorCheck } from 'lucide-react'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const queryClient = useQueryClient()

  const { data: restaurantData } = useQuery({
    queryKey: ['restaurant'],
    queryFn: () => api.get('/restaurant').then(r => r.data),
  })

  const [form, setForm] = useState({
    name: restaurant?.name || '',
    address: '',
    phone: '',
    email: '',
    description: '',
  })

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (data: typeof form) => api.put('/restaurant', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success(t('settings.saved'))
    },
  })

  const menuUrl = `${window.location.origin}/menu/${restaurant?.slug}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`
  const kitchenUrl = `${window.location.origin}/cucina`

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="aura-page-title">{t('settings.title')}</h1>
        <p className="aura-page-subtitle">{t('settings.subtitle')}</p>
      </div>

      {/* Lingua */}
      <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
        <h2 className="text-base font-semibold text-stone-100 mb-1">{t('common.language')}</h2>
        <p className="text-sm text-stone-400 mb-4">{t('common.languageDescription')}</p>
        <LanguageSwitcher />
      </div>

      {/* Info ristorante */}
      <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
        <h2 className="text-base font-semibold text-stone-100 mb-4">{t('settings.restaurantInfo')}</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-200 mb-1.5">{t('settings.restaurantName')}</label>
              <input value={form.name} onChange={e => update('name', e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1.5">{t('common.phone')}</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1.5">{t('common.email')}</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-200 mb-1.5">{t('settings.address')}</label>
              <input value={form.address} onChange={e => update('address', e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-200 mb-1.5">{t('common.description')}</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35 resize-none"
                rows={3} />
            </div>
          </div>
          <button onClick={() => save.mutate(form)} disabled={save.isPending}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" />
            {save.isPending ? t('common.saving') : t('settings.saveChanges')}
          </button>
        </div>
      </div>

      {/* QR Code Menu */}
      <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
        <h2 className="text-base font-semibold text-stone-100 mb-2">{t('settings.qrMenu')}</h2>
        <p className="text-sm text-stone-400 mb-4">{t('settings.qrMenuDesc')}</p>
        <div className="flex items-start gap-6">
          <div className="bg-stone-900/55 p-3 border-2 border-stone-800/50 rounded-xl">
            <img src={qrUrl} alt="QR Menu" className="w-32 h-32" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-stone-400 mb-1">{t('settings.publicMenuLink')}</p>
              <code className="text-xs bg-stone-800/50 px-3 py-1.5 rounded-lg text-stone-300 block break-all">{menuUrl}</code>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.open(menuUrl, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-stone-800/50 hover:bg-slate-200 text-stone-200 rounded-xl text-sm font-medium transition-colors">
                <ExternalLink className="w-4 h-4" />
                {t('settings.openMenu')}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(menuUrl); toast.success(t('common.linkCopied')) }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-950/40 hover:bg-orange-200 text-amber-400 rounded-xl text-sm font-medium transition-colors">
                <QrCode className="w-4 h-4" />
                {t('common.copyLink')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kitchen Display */}
      <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
        <h2 className="text-base font-semibold text-stone-100 mb-2">{t('settings.kds')}</h2>
        <p className="text-sm text-stone-400 mb-4">{t('settings.kdsDesc')}</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-stone-800/50 px-3 py-2 rounded-lg text-stone-300 break-all">{kitchenUrl}</code>
          <button
            onClick={() => window.open(kitchenUrl, '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <MonitorCheck className="w-4 h-4" />
            {t('common.open')}
          </button>
        </div>
      </div>

      {/* Info account */}
      <div className="bg-stone-900/55 rounded-2xl p-6 border border-stone-800/50 shadow-sm">
        <h2 className="text-base font-semibold text-stone-100 mb-3">{t('settings.accountInfo')}</h2>
        <div className="space-y-2">
          {[
            { label: t('settings.restaurantId'), value: restaurantData?.id || '—' },
            { label: t('settings.slug'), value: restaurantData?.slug || '—' },
            { label: t('settings.database'), value: 'SQLite (locale)' },
            { label: t('settings.appVersion'), value: '1.0.0 MVP' },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-stone-800/40">
              <span className="text-sm text-stone-400">{row.label}</span>
              <span className="text-sm font-medium text-stone-200 font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
