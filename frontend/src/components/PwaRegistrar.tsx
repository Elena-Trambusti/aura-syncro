import { useEffect, useRef } from 'react'
import { toast } from '@/lib/toast'
import { registerSW } from 'virtual:pwa-register'
import i18n from '../i18n'
import { isInstalledAppShell } from '../lib/standaloneApp'

/** Minimo intervallo tra due controlli aggiornamento SW (evita reload/toast a raffica dopo deploy). */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Primo controllo differito: non disturbare l'apertura app. */
const INITIAL_UPDATE_DELAY_MS = 5 * 60 * 1000
/** Se l'utente ignora il prompt update, non riproporre subito. */
const UPDATE_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000
const UPDATE_PROMPT_KEY = 'pwa-update-prompt-ts'

/**
 * Registra il Service Worker in produzione.
 * Differito con requestIdleCallback per non penalizzare il first paint (landing / SEO).
 */
export default function PwaRegistrar() {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const lastUpdateCheckRef = useRef(0)
  const updatePromptShownRef = useRef(false)
  const applyUpdateRef = useRef<((reloadPage?: boolean) => Promise<void>) | undefined>(undefined)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    const isShell = isInstalledAppShell()

    const checkForUpdates = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      const registration = registrationRef.current
      if (!registration) return
      const now = Date.now()
      if (now - lastUpdateCheckRef.current < UPDATE_CHECK_INTERVAL_MS) return
      lastUpdateCheckRef.current = now
      void registration.update()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }

    const runRegister = () => {
      applyUpdateRef.current = registerSW({
        // immediate:true in TWA causava reload a raffica dopo il riattivamento del SW.
        immediate: false,
        onRegistered(registration) {
          registrationRef.current = registration
          console.info('[Aura Syncro PWA] Service Worker registrato:', registration?.scope)
          if (!isShell) {
            window.setTimeout(checkForUpdates, INITIAL_UPDATE_DELAY_MS)
          }
        },
        onRegisterError(error) {
          console.error('[Aura Syncro PWA] Errore registrazione Service Worker:', error)
        },
        onNeedRefresh() {
          if (updatePromptShownRef.current) return
          const lastPromptTs = Number(localStorage.getItem(UPDATE_PROMPT_KEY) ?? '0')
          const now = Date.now()
          if (now - lastPromptTs < UPDATE_PROMPT_COOLDOWN_MS) return
          updatePromptShownRef.current = true
          localStorage.setItem(UPDATE_PROMPT_KEY, String(now))
          toast.message(i18n.t('pwa.updateAvailable'), {
            id: 'pwa-update',
            duration: Infinity,
            action: {
              label: i18n.t('pwa.updateRefresh'),
              onClick: () => {
                void applyUpdateRef.current?.(true)
              },
            },
          })
        },
      })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    // Registra subito: PWABuilder e Lighthouse non attendono requestIdleCallback.
    runRegister()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
