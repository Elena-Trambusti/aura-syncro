import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import type { CountryCode, TaxRegion } from '../lib/fiscalRegime'
import { defaultTaxRateForRegion, normalizeTaxRateForRegion } from '../lib/fiscalRegime'
import { Save, QrCode, ExternalLink, MonitorCheck, CalendarDays, Copy, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { formatApiError } from '../lib/formatApiError'
import { toast } from '@/lib/toast'
import { openPublicPreviewOrNotify } from '../lib/openPublicPreview'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import { useInstantMutation } from '../hooks/useInstantMutation'
import AuraButton from '../components/ui/AuraButton'

interface RestaurantSettings {
  countryCode?: CountryCode
  taxRegion?: TaxRegion
  taxRate?: number
  taxId?: string | null
  legalName?: string | null
  legalAddress?: string | null
  legalCity?: string | null
  legalZip?: string | null
  legalProvince?: string | null
  fiscalCode?: string | null
  pec?: string | null
  sdiRecipientCode?: string | null
  invoicePrefix?: string
  defaultLocale?: string
  noShowDepositRequired?: boolean | null
  depositAmount?: number | null
  posProviderLabel?: string | null
  posTerminalId?: string | null
  laborHourlyRate?: number | null
  telegramChatId?: string | null
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
  taxRate: number | ''
  taxId: string
  legalName: string
  legalAddress: string
  legalCity: string
  legalZip: string
  legalProvince: string
  fiscalCode: string
  pec: string
  sdiRecipientCode: string
  invoicePrefix: string
  noShowDepositRequired: boolean
  depositAmount: number | ''
  posProviderLabel: string
  posTerminalId: string
  laborHourlyRate: number | ''
}

function buildSavePayload(data: SettingsForm) {
  const emptyToNull = (v: string) => v.trim() || null
  const rawRate = data.taxRate === '' ? undefined : data.taxRate
  const taxRate = rawRate != null
    ? normalizeTaxRateForRegion(data.taxRegion, rawRate)
    : undefined

  return {
    name: data.name.trim(),
    address: emptyToNull(data.address),
    phone: emptyToNull(data.phone),
    email: emptyToNull(data.email),
    description: emptyToNull(data.description),
    settings: {
      countryCode: data.countryCode,
      taxRegion: data.taxRegion,
      taxRate,
      taxId: emptyToNull(data.taxId),
      legalName: emptyToNull(data.legalName),
      legalAddress: emptyToNull(data.legalAddress),
      legalCity: emptyToNull(data.legalCity),
      legalZip: emptyToNull(data.legalZip),
      legalProvince: emptyToNull(data.legalProvince),
      fiscalCode: emptyToNull(data.fiscalCode),
      pec: emptyToNull(data.pec),
      sdiRecipientCode: emptyToNull(data.sdiRecipientCode),
      invoicePrefix: data.invoicePrefix.trim().toUpperCase() || 'FATT',
      noShowDepositRequired: data.noShowDepositRequired,
      depositAmount: data.depositAmount === '' ? 0 : data.depositAmount,
      posProviderLabel: emptyToNull(data.posProviderLabel),
      posTerminalId: emptyToNull(data.posTerminalId),
      ...(data.laborHourlyRate !== '' ? { laborHourlyRate: data.laborHourlyRate } : {}),
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

  const [form, setForm] = useState<SettingsForm>({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
    countryCode: 'IT' as CountryCode,
    taxRegion: 'IT_MAIN' as TaxRegion,
    taxRate: defaultTaxRateForRegion('IT_MAIN'),
    taxId: '',
    legalName: '',
    legalAddress: '',
    legalCity: '',
    legalZip: '',
    legalProvince: '',
    fiscalCode: '',
    pec: '',
    sdiRecipientCode: '',
    invoicePrefix: 'FATT',
    noShowDepositRequired: false,
    depositAmount: 20,
    posProviderLabel: '',
    posTerminalId: '',
    laborHourlyRate: '',
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
      taxRate: restaurantData.settings?.taxRate ?? defaultTaxRateForRegion(restaurantData.settings?.taxRegion || 'IT_MAIN'),
      taxId: restaurantData.settings?.taxId || '',
      legalName: restaurantData.settings?.legalName || '',
      legalAddress: restaurantData.settings?.legalAddress || '',
      legalCity: restaurantData.settings?.legalCity || '',
      legalZip: restaurantData.settings?.legalZip || '',
      legalProvince: restaurantData.settings?.legalProvince || '',
      fiscalCode: restaurantData.settings?.fiscalCode || '',
      pec: restaurantData.settings?.pec || '',
      sdiRecipientCode: restaurantData.settings?.sdiRecipientCode || '',
      invoicePrefix: restaurantData.settings?.invoicePrefix || 'FATT',
      noShowDepositRequired: restaurantData.settings?.noShowDepositRequired ?? false,
      depositAmount: restaurantData.settings?.depositAmount ?? 20,
      posProviderLabel: restaurantData.settings?.posProviderLabel || '',
      posTerminalId: restaurantData.settings?.posTerminalId || '',
      laborHourlyRate: restaurantData.settings?.laborHourlyRate ?? '',
    })
  }, [restaurantData, restaurant?.name])

  const update = (k: string, v: string | number | boolean) => setForm(f => ({ ...f, [k]: v }))

  const onCountryChange = (countryCode: CountryCode) => {
    setForm(f => {
      const taxRegion: TaxRegion = countryCode === 'ES'
        ? (f.taxRegion.startsWith('ES_') ? f.taxRegion : 'ES_PENINSULA')
        : 'IT_MAIN'
      return {
        ...f,
        countryCode,
        taxRegion,
        taxRate: defaultTaxRateForRegion(taxRegion),
      }
    })
  }

  const onTaxRegionChange = (taxRegion: TaxRegion) => {
    setForm(f => ({
      ...f,
      taxRegion,
      taxRate: defaultTaxRateForRegion(taxRegion),
    }))
  }

  const save = useInstantMutation({
    mutationFn: (data: typeof form) => api.put('/restaurant', buildSavePayload(data)),
    onInstant: () => {
      toast.success(t('settings.saved'))
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'restaurant') })
      await refreshRestaurant()
    },
    onError: (err: unknown) => {
      toast.error(formatApiError(t, err))
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
  const bookingUrl = `${window.location.origin}/prenota/${restaurant?.slug}`
  const kitchenUrl = `${window.location.origin}/cucina`

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('common.linkCopied'))
  }

  return (
    <ExecutivePageShell className="space-y-6 max-w-2xl">
      {isError && <QueryErrorBanner />}
      <ExecutivePageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-1">{t('common.language')}</h2>
        <p className="text-sm text-fumo mb-4">{t('common.languageDescription')}</p>
        <LanguageSwitcher />
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-1">{t('settings.fiscalTitle')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.fiscalDesc')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.country')}</label>
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
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.taxRegion')}</label>
            <select
              value={form.taxRegion}
              onChange={e => onTaxRegionChange(e.target.value as TaxRegion)}
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
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.taxRate')}</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.taxRate}
              onChange={e => update('taxRate', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.taxId')}</label>
            <input
              value={form.taxId}
              onChange={e => update('taxId', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
        </div>
        <p className="text-xs text-fumo mt-4">{t('settings.saveHint')}</p>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-1">{t('settings.billingTitle')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.billingDesc')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.legalName')}</label>
            <input
              value={form.legalName}
              onChange={e => update('legalName', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.legalAddress')}</label>
            <input
              value={form.legalAddress}
              onChange={e => update('legalAddress', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.legalCity')}</label>
            <input
              value={form.legalCity}
              onChange={e => update('legalCity', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.legalZip')}</label>
            <input
              value={form.legalZip}
              onChange={e => update('legalZip', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.legalProvince')}</label>
            <input
              value={form.legalProvince}
              onChange={e => update('legalProvince', e.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              className="w-full px-4 py-2.5 saas-input font-mono"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.fiscalCode')}</label>
            <input
              value={form.fiscalCode}
              onChange={e => update('fiscalCode', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.pec')}</label>
            <input
              type="email"
              value={form.pec}
              onChange={e => update('pec', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.sdiRecipientCode')}</label>
            <input
              value={form.sdiRecipientCode}
              onChange={e => update('sdiRecipientCode', e.target.value.toUpperCase().slice(0, 7))}
              maxLength={7}
              className="w-full px-4 py-2.5 saas-input font-mono"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.invoicePrefix')}</label>
            <input
              value={form.invoicePrefix}
              onChange={e => update('invoicePrefix', e.target.value.toUpperCase().slice(0, 12))}
              maxLength={12}
              className="w-full px-4 py-2.5 saas-input font-mono"
            />
            <p className="text-xs text-fumo mt-1">{t('settings.invoicePrefixHint')}</p>
          </div>
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-4">{t('settings.restaurantInfo')}</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.restaurantName')}</label>
              <input value={form.name} onChange={e => update('name', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1.5">{t('common.phone')}</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-fumo mb-1.5">{t('common.email')}</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.address')}</label>
              <input value={form.address} onChange={e => update('address', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-fumo mb-1.5">{t('common.description')}</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="w-full px-4 py-2.5 saas-input w-full focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50 resize-none"
                rows={3} />
            </div>
          </div>
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-1">{t('settings.reservationsTitle')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.reservationsDesc')}</p>
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.noShowDepositRequired}
              onChange={e => update('noShowDepositRequired', e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-navy-surface text-aura-gold focus:ring-aura-gold/30"
            />
            <div>
              <span className="block text-sm font-medium text-pietra">{t('settings.depositRequired')}</span>
              <span className="block text-xs text-fumo">{t('settings.depositHint')}</span>
            </div>
          </label>
          {form.noShowDepositRequired && (
            <div>
              <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.depositAmountLabel')}</label>
              <input
                type="number"
                min={1}
                value={form.depositAmount}
                onChange={e => update('depositAmount', e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full sm:w-1/3 px-4 py-2.5 saas-input focus:outline-none focus:ring-2 focus:ring-aura-gold/30 focus:border-aura-gold/50"
              />
            </div>
          )}
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-2">{t('settings.qrMenu')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.qrMenuDesc')}</p>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-fumo mb-1">{t('settings.publicMenuLink')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-navy-surface/50 border border-white/[0.08] px-3 py-1.5 rounded-lg text-fumo block break-all">{menuUrl}</code>
              <button
                type="button"
                onClick={() => copyToClipboard(menuUrl)}
                className="shrink-0 rounded-lg border border-white/[0.08] p-2 text-fumo hover:bg-white/[0.05]"
                aria-label={t('common.copyLink')}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/qr-builder"
              className="flex items-center gap-2 px-4 py-2 bg-aura-gold hover:bg-aura-gold text-navy font-semibold rounded-xl text-sm font-semibold transition-colors"
            >
              <QrCode className="w-4 h-4" />
              {t('nav.qrMenu')}
            </Link>
            <button
              type="button"
              onClick={() => openPublicPreviewOrNotify(menuUrl)}
              className="flex items-center gap-2 px-4 py-2 premium-card hover:bg-white/[0.05] text-fumo rounded-xl text-sm font-medium transition-colors">
              <ExternalLink className="w-4 h-4" />
              {t('settings.openMenu')}
            </button>
          </div>
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-2">{t('settings.qrBooking')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.qrBookingDesc')}</p>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-fumo mb-1">{t('settings.publicBookingLink')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-navy-surface/50 border border-white/[0.08] px-3 py-1.5 rounded-lg text-fumo block break-all">{bookingUrl}</code>
              <button
                type="button"
                onClick={() => copyToClipboard(bookingUrl)}
                className="shrink-0 rounded-lg border border-white/[0.08] p-2 text-fumo hover:bg-white/[0.05]"
                aria-label={t('common.copyLink')}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/qr-builder"
              className="flex items-center gap-2 px-4 py-2 bg-aura-gold hover:bg-aura-gold text-navy font-semibold rounded-xl text-sm font-semibold transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              {t('settings.bookingQr')}
            </Link>
            <button
              type="button"
              onClick={() => openPublicPreviewOrNotify(bookingUrl)}
              className="flex items-center gap-2 px-4 py-2 premium-card hover:bg-white/[0.05] text-fumo rounded-xl text-sm font-medium transition-colors">
              <ExternalLink className="w-4 h-4" />
              {t('settings.openBooking')}
            </button>
          </div>
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-2">{t('settings.kds')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.kdsDesc')}</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-navy-surface px-3 py-2 rounded-lg text-pietra break-all">{kitchenUrl}</code>
          <button
            onClick={() => openPublicPreviewOrNotify(kitchenUrl)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <MonitorCheck className="w-4 h-4" />
            {t('common.open')}
          </button>
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-3">{t('settings.laborRate')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.laborRateDesc')}</p>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.laborRateUnit')}</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={form.laborHourlyRate}
            onChange={e => update('laborHourlyRate', e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-4 py-2.5 saas-input"
          />
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-3">{t('settings.posFiscalTitle')}</h2>
        <p className="text-sm text-fumo mb-4">{t('settings.posFiscalDesc')}</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.posBrandLabel')}</label>
            <select
              value={form.posProviderLabel}
              onChange={e => update('posProviderLabel', e.target.value)}
              className="w-full px-4 py-2.5 saas-input"
            >
              <option value="">{t('settings.posNone')}</option>
              <option value="CUSTOM">Custom</option>
              <option value="EPSON">Epson</option>
            </select>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-fumo mb-1.5">{t('settings.posIpLabel')}</label>
            <input
              type="text"
              value={form.posTerminalId}
              onChange={e => update('posTerminalId', e.target.value)}
              placeholder="192.168.1.100"
              className="w-full px-4 py-2.5 saas-input font-mono placeholder:text-white/20"
              disabled={!form.posProviderLabel}
            />
          </div>
        </div>
        
        {form.posProviderLabel && (
          <p className="mt-4 text-xs text-aura-gold/80 bg-aura-gold/10 p-3 rounded-lg border border-aura-gold/20">
            {t('settings.posNetworkHint')}
          </p>
        )}
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-2">Notifiche AI su Telegram</h2>
        <p className="text-sm text-fumo mb-4">Collega il tuo account Telegram per ricevere in tempo reale gli alert predittivi e i consigli sui riordini direttamente sul tuo smartphone.</p>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.open(`https://t.me/AuraSyncroBot?start=${restaurantData?.id}`, '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl text-sm font-semibold transition-colors">
              <Send className="w-4 h-4" />
              Collega Telegram
            </button>
          </div>
          {restaurantData?.settings?.telegramChatId && (
            <p className="text-xs text-green-400/90 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
              ✅ Telegram è già collegato! Riceverai le notifiche AI su questo account.
            </p>
          )}
        </div>
      </div>

      <div className="premium-card p-6">
        <h2 className="text-base font-semibold text-pietra mb-3">{t('settings.accountInfo')}</h2>
        <div className="space-y-2">
          {[
            { label: t('settings.restaurantId'), value: restaurantData?.id || '—' },
            { label: t('settings.slug'), value: restaurantData?.slug || '—' },
            { label: t('settings.country'), value: form.countryCode },
            { label: t('settings.taxRegion'), value: form.taxRegion },
            { label: t('settings.appVersion'), value: '1.0.0 MVP' },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-white/[0.08]">
              <span className="text-sm text-fumo">{row.label}</span>
              <span className="text-sm font-medium text-fumo font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-4 z-20">
        <AuraButton
          type="button"
          instant
          onClick={handleSave}
          className="w-full gap-2 px-5 py-3 text-sm font-semibold shadow-lg"
        >
          <Save className="w-4 h-4" />
          {t('settings.saveChanges')}
        </AuraButton>
      </div>
    </ExecutivePageShell>
  )
}
