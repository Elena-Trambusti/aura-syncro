import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, CalendarHeart, Info, CheckCircle2, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'



export default function OnboardingPage() {
  const { t } = useTranslation()
  const { restaurant, refreshRestaurant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [checklist, setChecklist] = useState({ menu: false, call: false })

  const TALLY_URL = 'https://tally.so/r/WOQp1P'
  const CALENDLY_URL = 'https://calendly.com/aurasyncro/30min'

  const checklistDone = Number(checklist.menu) + Number(checklist.call)

  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      toast.success(t('onboarding.welcomeToast'))
      setSearchParams({}, { replace: true })
      void refreshRestaurant()
    }
  }, [searchParams, setSearchParams, t, refreshRestaurant])

  // Polling: rileva sblocco concierge e attivazione abbonamento post-pagamento
  useEffect(() => {
    const fast = searchParams.get('welcome') === 'true' || restaurant?.hasActiveSubscription === false
    const ms = fast ? 5_000 : 30_000
    const interval = window.setInterval(() => {
      void refreshRestaurant()
    }, ms)
    return () => window.clearInterval(interval)
  }, [refreshRestaurant, searchParams, restaurant?.hasActiveSubscription])



  return (
    <ExecutivePageShell className="mx-auto max-w-4xl space-y-8 pb-8">
      <ExecutivePageHeader
        title={t('onboarding.title')}
        subtitle={t('onboarding.subtitle', { name: restaurant?.name ?? '' })}
        eyebrow={t('onboarding.badge')}
      />

      <section className="rounded-xl premium-card p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-pietra">{t('onboarding.checklistTitle')}</h2>
        <p className="mb-4 text-sm text-fumo">{t('onboarding.progressLabel', { done: checklistDone, total: 2 })}</p>
        <ul className="space-y-3">
          {([
            { key: 'menu' as const, label: t('onboarding.checklistMenu') },
            { key: 'call' as const, label: t('onboarding.checklistCall') },
          ]).map(item => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setChecklist(c => ({ ...c, [item.key]: !c[item.key] }))}
                className="flex w-full items-center gap-3 rounded-lg border border-white/[0.08] px-4 py-3 text-left text-sm hover:bg-white/[0.03]"
              >
                {checklist[item.key]
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  : <Circle className="h-5 w-5 shrink-0 text-fumo" />}
                <span className={checklist[item.key] ? 'text-fumo line-through' : 'text-pietra'}>{item.label}</span>
                <span className="ml-auto text-xs text-fumo">
                  {checklist[item.key] ? t('onboarding.checklistDone') : t('onboarding.checklistPending')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-fumo leading-relaxed">{t('onboarding.posSetupNote')}</p>
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
            Compila il modulo
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
            Prenota la Call
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

