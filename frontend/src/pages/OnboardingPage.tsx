import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, CalendarHeart, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'

const TALLY_EMBED_SRC =
  'https://tally.so/embed/WOQp1P?alignLeft=1&transparentBackground=1&dynamicHeight=1&formEventsForwarding=1'
const CALENDLY_URL = 'https://calendly.com/aurasyncro'
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl premium-card p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <ClipboardList className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-pietra">{t('onboarding.menuBlockTitle')}</h2>
              <p className="text-xs text-fumo">{t('onboarding.menuBlockHint')}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg premium-card">
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
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <CalendarHeart className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="font-bold text-pietra">{t('onboarding.callBlockTitle')}</h2>
              <p className="text-xs text-fumo">{t('onboarding.callBlockHint')}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg premium-card">
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
