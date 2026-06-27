import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, CalendarHeart, Info, CheckCircle2, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'

const TALLY_EMBED_SRC =
  'https://tally.so/embed/WOQp1P?alignLeft=1&transparentBackground=1&dynamicHeight=1&formEventsForwarding=1'
const CALENDLY_URL = 'https://calendly.com/aurasyncro/30min'
const TALLY_SCRIPT_SRC = 'https://tally.so/widgets/embed.js'
const CALENDLY_SCRIPT_SRC = 'https://assets.calendly.com/assets/external/widget.js'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.body.appendChild(script)
  })
}

export default function OnboardingPage() {
  const { t } = useTranslation()
  const { restaurant, refreshRestaurant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const calendlyRef = useRef<HTMLDivElement>(null)
  const [checklist, setChecklist] = useState({ menu: false, call: false })

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

  useEffect(() => {
    void loadScript(TALLY_SCRIPT_SRC)
  }, [])

  useEffect(() => {
    const initCalendly = () => {
      const parent = calendlyRef.current
      if (!parent) return

      if (window.Calendly?.initInlineWidget) {
        parent.innerHTML = ''
        window.Calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: parent,
        })
      }
    }

    void loadScript(CALENDLY_SCRIPT_SRC).then(initCalendly).catch(() => {
      /* widget opzionale — il div resta visibile */
    })
  }, [])

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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl premium-card p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <ClipboardList className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-pietra">{t('onboarding.menuBlockTitle')}</h2>
                <p className="text-xs text-fumo">{t('onboarding.menuBlockHint')}</p>
              </div>
            </div>
            <a
              href="https://tally.so/r/WOQp1P"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 px-4 py-2 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            >
              Apri in nuova scheda
            </a>
          </div>
          <div className="overflow-hidden rounded-lg premium-card relative">
            <div className="sm:hidden p-4 border-b border-white/5 flex justify-center bg-white/[0.02]">
              <a
                href="https://tally.so/r/WOQp1P"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 px-4 py-2 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
              >
                Compila il Modulo Dati
              </a>
            </div>
            <iframe
              data-tally-src={TALLY_EMBED_SRC}
              loading="lazy"
              width="100%"
              height="284"
              frameBorder={0}
              marginHeight={0}
              marginWidth={0}
              title={t('onboarding.menuBlockTitle')}
              className="w-full border-0"
              style={{ width: '100%', minHeight: '284px' }}
            />
          </div>
        </section>

        <section className="rounded-xl premium-card p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <CalendarHeart className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-pietra">{t('onboarding.callBlockTitle')}</h2>
                <p className="text-xs text-fumo">{t('onboarding.callBlockHint')}</p>
              </div>
            </div>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 px-4 py-2 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            >
              Apri in nuova scheda
            </a>
          </div>
          <div className="overflow-hidden rounded-lg premium-card relative">
            <div className="sm:hidden p-4 border-b border-white/5 flex justify-center bg-white/[0.02]">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 px-4 py-2 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
              >
                Prenota la Call
              </a>
            </div>
            <div
              ref={calendlyRef}
              className="calendly-inline-widget"
              data-url={CALENDLY_URL}
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, height: '700px' }}
            />
          </div>
        </section>
      </div>

      <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-500/10/80 p-4 sm:p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
        <p className="text-sm leading-relaxed text-blue-900">{t('onboarding.teamNote')}</p>
      </div>
    </ExecutivePageShell>
  )
}

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void
    }
  }
}
