import { LogIn, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { resetStandaloneAppSession } from '../../lib/bootstrapStandalone'
import { isStandaloneApp } from '../../lib/standaloneApp'

const HIDDEN_ON = new Set(['/login', '/register', '/forgot-password', '/reset-password'])

/** Pulsante di emergenza visibile nell'APK quando l'utente resta bloccato su schermo nero. */
export default function StandaloneRecoveryBar() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '') || '/'

  if (!isStandaloneApp() || HIDDEN_ON.has(path)) return null

  return (
    <div className="standalone-recovery-bar pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex max-w-md flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-navy-surface/95 px-3 py-2 shadow-2xl">
        <button
          type="button"
          onClick={() => { window.location.assign('/login?pwa=1') }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-aura-gold/30 bg-aura-gold/10 px-3 py-2 text-xs font-semibold text-aura-gold"
        >
          <LogIn className="h-3.5 w-3.5" aria-hidden />
          {t('pwa.backToLogin')}
        </button>
        <button
          type="button"
          onClick={() => void resetStandaloneAppSession()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-navy-mid px-3 py-2 text-xs font-semibold text-pietra"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('pwa.resetApp')}
        </button>
      </div>
    </div>
  )
}
