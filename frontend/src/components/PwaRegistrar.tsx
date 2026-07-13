import { useEffect, useRef } from 'react'
import { toast } from '@/lib/toast'
import { registerSW } from 'virtual:pwa-register'
import i18n from '../i18n'
import { isInstalledAppShell } from '../lib/standaloneApp'
import { registerPwaPeriodicSync } from '../lib/pwaPeriodicSync'

/** Minimo intervallo tra due controlli aggiornamento SW (evita reload/toast a raffica dopo deploy). */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Primo controllo differito: non disturbare l'apertura app. */
const INITIAL_UPDATE_DELAY_MS = 5 * 60 * 1000
/** Se l'utente ignora il prompt update, non riproporre subito. */
const UPDATE_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000
const UPDATE_PROMPT_KEY = 'pwa-update-prompt-ts'

/**
 * Aggiornamenti SW e Periodic Sync.
 * La registrazione base avviene in index.html + vite injectRegister (PWABuilder).
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

    const onRegistered = (registration?: ServiceWorkerRegistration) => {
      registrationRef.current = registration
      if (registration) {
        console.info('[Aura Syncro PWA] Service Worker registrato:', registration.scope)
        void registerPwaPeriodicSync(registration)
      }
      if (!isShell) {
        window.setTimeout(checkForUpdates, INITIAL_UPDATE_DELAY_MS)
      }
    }

    const registerOptions = {
      immediate: false,
      onRegistered,
      onRegisterError(error: unknown) {
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
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    void (async () => {
      const existing = await navigator.serviceWorker.getRegistration()
      if (existing?.active) {
        onRegistered(existing)
        return
      }
      applyUpdateRef.current = registerSW(registerOptions)
    })()

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
