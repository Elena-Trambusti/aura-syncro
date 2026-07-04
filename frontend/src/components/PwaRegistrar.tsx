import { useEffect } from 'react'
import { toast } from '@/lib/toast'
import { registerSW } from 'virtual:pwa-register'
import i18n from '../i18n'

/**
 * Registra il Service Worker in produzione.
 * Differito con requestIdleCallback per non penalizzare il first paint (landing / SEO).
 */
export default function PwaRegistrar() {
  useEffect(() => {
    if (!import.meta.env.PROD) return

    const runRegister = () => {
      registerSW({
        immediate: true,
        onRegistered(registration) {
          console.info('[Aura Syncro PWA] Service Worker registrato:', registration?.scope)
          // Controlla subito aggiornamenti (bundle JS/CSS nuovi dopo deploy)
          void registration?.update()
        },
        onRegisterError(error) {
          console.error('[Aura Syncro PWA] Errore registrazione Service Worker:', error)
        },
        onNeedRefresh() {
          toast.message(i18n.t('pwa.updateAvailable', { defaultValue: 'Nuova versione disponibile — ricarico…' }), {
            id: 'pwa-update',
            duration: 3000,
          })
          window.setTimeout(() => window.location.reload(), 1500)
        },
      })
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(runRegister, { timeout: 5000 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeoutId = window.setTimeout(runRegister, 3000)
    return () => window.clearTimeout(timeoutId)
  }, [])

  return null
}
