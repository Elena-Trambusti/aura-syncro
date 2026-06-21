import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ClipboardList, CalendarHeart, Sparkles, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

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

  // Polling: rileva sblocco concierge senza logout manuale
  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshRestaurant()
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [refreshRestaurant])

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
    <div className="mx-auto max-w-4xl space-y-8 pb-8">
      <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-6 sm:p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
            <Sparkles className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              {t('onboarding.badge')}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {t('onboarding.title')}
            </h1>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          {t('onboarding.subtitle', { name: restaurant?.name ?? '' })}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">{t('onboarding.menuBlockTitle')}</h2>
              <p className="text-xs text-slate-500">{t('onboarding.menuBlockHint')}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <CalendarHeart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">{t('onboarding.callBlockTitle')}</h2>
              <p className="text-xs text-slate-500">{t('onboarding.callBlockHint')}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div
              ref={calendlyRef}
              className="calendly-inline-widget"
              data-url={CALENDLY_URL}
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, height: '700px' }}
            />
          </div>
        </section>
      </div>

      <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/80 p-4 sm:p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <p className="text-sm leading-relaxed text-blue-900">{t('onboarding.teamNote')}</p>
      </div>
    </div>
  )
}

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void
    }
  }
}
