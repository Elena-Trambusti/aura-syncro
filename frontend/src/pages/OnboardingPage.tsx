import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ClipboardList, CalendarHeart, Info, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { useAuth } from '../contexts/AuthContext'
import { useRole } from '../hooks/useRole'
import { api } from '../lib/api'
import { formatApiError } from '../lib/errors'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'

type ReadinessCheck = { id: string; ok: boolean; detail?: string }

type OnboardingReadiness = {
  readyForService: boolean
  checks: ReadinessCheck[]
  menuItemCount: number
  tableCount: number
  posMode: string
  cashSessionOpen: boolean
}

export default function OnboardingPage() {
  const { t } = useTranslation()
  const { restaurant, refreshRestaurant } = useAuth()
  const { canAccessAdminNav } = useRole()
  const isAdmin = canAccessAdminNav()
  const [searchParams, setSearchParams] = useSearchParams()
  const [concierge, setConcierge] = useState({ menu: false, call: false })

  const TALLY_URL = 'https://tally.so/r/WOQp1P'
  const CALENDLY_URL = 'https://calendly.com/aurasyncro/30min'

  const { data: readiness, isLoading: readinessLoading, refetch: refetchReadiness } = useQuery<OnboardingReadiness>({
    queryKey: ['onboarding-readiness', restaurant?.id],
    queryFn: () => api.get('/restaurant/onboarding-readiness').then(r => r.data),
    enabled: Boolean(restaurant?.id) && isAdmin,
    refetchInterval: isAdmin ? 15_000 : false,
  })

  const { data: savedConcierge } = useQuery<{ menu?: boolean; call?: boolean }>({
    queryKey: ['onboarding-concierge', restaurant?.id],
    queryFn: () => api.get('/restaurant/onboarding-concierge').then(r => r.data),
    enabled: Boolean(restaurant?.id) && isAdmin,
  })

  const saveConcierge = useMutation({
    mutationFn: (next: { menu: boolean; call: boolean }) =>
      api.patch('/restaurant/onboarding-concierge', next).then(r => r.data),
    onError: (err: unknown) => toast.error(formatApiError(err)),
  })

  useEffect(() => {
    if (savedConcierge) {
      setConcierge({ menu: !!savedConcierge.menu, call: !!savedConcierge.call })
    }
  }, [savedConcierge])

  const toggleConcierge = (key: 'menu' | 'call') => {
    if (!isAdmin) return
    const next = { ...concierge, [key]: !concierge[key] }
    setConcierge(next)
    saveConcierge.mutate(next)
  }

  const systemDone = readiness?.checks.filter(c => c.ok).length ?? 0
  const systemTotal = readiness?.checks.length ?? 0
  const conciergeDone = Number(concierge.menu) + Number(concierge.call)

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      toast.success(t('onboarding.welcomeToast'))
      setSearchParams({}, { replace: true })
      void refreshRestaurant()
      void refetchReadiness()
    }
  }, [searchParams, setSearchParams, t, refreshRestaurant, refetchReadiness])

  useEffect(() => {
    const fast = searchParams.get('welcome') === 'true' || restaurant?.hasActiveSubscription === false
    const ms = fast ? 5_000 : 30_000
    const interval = window.setInterval(() => {
      void refreshRestaurant()
      void refetchReadiness()
    }, ms)
    return () => window.clearInterval(interval)
  }, [refreshRestaurant, refetchReadiness, searchParams, restaurant?.hasActiveSubscription])

  const checkLabel = (id: string) => t(`onboarding.systemChecks.${id}`, { defaultValue: id })

  return (
    <ExecutivePageShell className="mx-auto max-w-4xl space-y-8 pb-8">
      <ExecutivePageHeader
        title={t('onboarding.title')}
        subtitle={t('onboarding.subtitle', { name: restaurant?.name ?? '' })}
        eyebrow={t('onboarding.badge')}
      />

      <section className="rounded-xl premium-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-pietra">{t('onboarding.systemChecklistTitle')}</h2>
          {isAdmin && readinessLoading && <Loader2 className="h-4 w-4 animate-spin text-fumo" />}
        </div>
        {!isAdmin ? (
          <p className="text-sm text-fumo">{t('onboarding.staffReadinessHint', { defaultValue: 'La checklist tecnica è visibile a titolare e manager. Contatta il responsabile per completare il setup.' })}</p>
        ) : (
          <>
        <p className="mb-4 text-sm text-fumo">
          {t('onboarding.systemProgressLabel', { done: systemDone, total: systemTotal })}
        </p>
        <ul className="space-y-2">
          {(readiness?.checks ?? []).map(item => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-white/[0.08] px-4 py-3 text-sm"
            >
              {item.ok
                ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                : <Circle className="h-5 w-5 shrink-0 text-amber-400" />}
              <span className={item.ok ? 'text-fumo' : 'text-pietra font-medium'}>
                {checkLabel(item.id)}
              </span>
              {item.detail && (
                <span className="ml-auto text-xs text-fumo">{item.detail}</span>
              )}
            </li>
          ))}
        </ul>
        {readiness?.readyForService && (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {t('onboarding.systemReady')}
          </p>
        )}
          </>
        )}
      </section>

      <section className="rounded-xl premium-card p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-pietra">{t('onboarding.checklistTitle')}</h2>
        {!isAdmin ? (
          <p className="text-sm text-fumo">{t('onboarding.staffConciergeHint', { defaultValue: 'I passaggi concierge sono gestiti dal titolare o dal manager del locale.' })}</p>
        ) : (
          <>
        <p className="mb-4 text-sm text-fumo">{t('onboarding.progressLabel', { done: conciergeDone, total: 2 })}</p>
        <ul className="space-y-3">
          {([
            { key: 'menu' as const, label: t('onboarding.checklistMenu') },
            { key: 'call' as const, label: t('onboarding.checklistCall') },
          ]).map(item => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => toggleConcierge(item.key)}
                className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] px-4 py-3 text-left text-sm hover:bg-white/[0.03]"
              >
                {concierge[item.key]
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  : <Circle className="h-5 w-5 shrink-0 text-fumo" />}
                <span className={concierge[item.key] ? 'text-fumo line-through' : 'text-pietra'}>{item.label}</span>
                <span className="ml-auto text-xs text-fumo">
                  {concierge[item.key] ? t('onboarding.checklistDone') : t('onboarding.checklistPending')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-fumo leading-relaxed">{t('onboarding.posSetupNote')}</p>
          </>
        )}
      </section>

      <div className="grid gap-6">
        <section className="rounded-2xl premium-card p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row items-center gap-6 justify-between relative overflow-hidden group border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 relative z-10">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <ClipboardList className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{t('onboarding.menuBlockTitle')}</h2>
              <p className="text-sm text-stone-400 max-w-lg leading-relaxed">{t('onboarding.menuBlockHint')}</p>
            </div>
          </div>
          <a
            href={TALLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-64 shrink-0 inline-flex justify-center items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(234,179,8,0.2)] hover:shadow-[0_0_35px_rgba(234,179,8,0.3)] hover:scale-105 whitespace-nowrap relative z-10"
          >
            {t('onboarding.fillForm')}
          </a>
        </section>

        <section className="rounded-2xl premium-card p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row items-center gap-6 justify-between relative overflow-hidden group border border-indigo-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5 relative z-10">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
              <CalendarHeart className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{t('onboarding.callBlockTitle')}</h2>
              <p className="text-sm text-stone-400 max-w-lg leading-relaxed">{t('onboarding.callBlockHint')}</p>
            </div>
          </div>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-64 shrink-0 inline-flex justify-center items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 px-8 py-4 text-sm font-bold uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(234,179,8,0.2)] hover:shadow-[0_0_35px_rgba(234,179,8,0.3)] hover:scale-105 whitespace-nowrap relative z-10"
          >
            {t('onboarding.bookCall')}
          </a>
        </section>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-aura-gold/30 bg-[#1a1710] p-5 sm:p-6">
        <div className="absolute inset-0 bg-aura-gold/10 animate-pulse" />
        <div className="absolute inset-0 shadow-[0_0_30px_rgba(234,179,8,0.15)_inset] animate-pulse" />
        <div className="relative z-10 flex gap-4 items-start">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-aura-gold drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
          <p className="text-sm font-medium leading-relaxed text-aura-gold-light drop-shadow-[0_0_2px_rgba(234,179,8,0.3)]">
            {t('onboarding.teamNote')}
          </p>
        </div>
      </div>
    </ExecutivePageShell>
  )
}
