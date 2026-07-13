import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Cookie } from 'lucide-react'
import { getCookieConsent, setCookieConsent } from '../../lib/cookieConsent'

export function CookieBanner() {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!getCookieConsent()) {
      const timer = setTimeout(() => setIsVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAll = () => {
    setCookieConsent('all')
    setIsVisible(false)
  }

  const handleNecessary = () => {
    setCookieConsent('necessary')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg animate-reveal-slide [animation-fill-mode:both]"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/95 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-aura-gold/10 blur-[40px] pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-aura-gold shadow-inner">
            <Cookie className="h-5 w-5" aria-hidden />
          </div>

          <div className="flex-1 min-w-0">
            <h3 id="cookie-banner-title" className="text-sm font-semibold text-white">
              {t('legal.cookieBanner.title')}
            </h3>
            <p id="cookie-banner-desc" className="mt-1 text-xs leading-relaxed text-slate-400">
              {t('legal.cookieBanner.description')}{' '}
              <Link to="/cookie" className="text-aura-gold hover:underline">
                {t('legal.cookieBanner.policyLink')}
              </Link>
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleAll}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all hover:scale-[1.02]"
              >
                {t('legal.cookieBanner.acceptAll')}
              </button>
              <button
                type="button"
                onClick={handleNecessary}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:bg-white/10"
              >
                {t('legal.cookieBanner.necessaryOnly')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
