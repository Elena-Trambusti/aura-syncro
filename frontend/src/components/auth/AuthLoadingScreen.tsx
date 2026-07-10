import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resetStandaloneAppSession } from '../../lib/bootstrapStandalone'
import { isStandaloneApp } from '../../lib/standaloneApp'

const LOADING_TIMEOUT_MS = 15_000

/** Schermata di attesa finché /auth/me non risolve lo stato tenant (evita flash delle pagine protette). */
export default function AuthLoadingScreen() {
  const { t } = useTranslation()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center aura-auth-shell px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-aura-gold/30 border-t-aura-gold" />
        <p className="font-medium text-fumo">{t('common.loading', { defaultValue: 'Caricamento…' })}</p>
        {timedOut && (
          <div className="space-y-3">
            <p className="text-sm text-fumo">{t('pwa.loadingTimeout')}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-aura-gold px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-aura-gold-light"
            >
              {t('pwa.loadingRetry')}
            </button>
            {isStandaloneApp() && (
              <button
                type="button"
                onClick={() => void resetStandaloneAppSession()}
                className="rounded-xl border border-white/[0.1] px-5 py-2.5 text-sm font-semibold text-pietra"
              >
                {t('pwa.resetApp')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
