import { useEffect } from 'react'
import { toast } from '@/lib/toast'
import { registerSW } from 'virtual:pwa-register'

/**
 * Registra il Service Worker in produzione.
 * Aggiornamenti silenziosi (autoUpdate).
 */
export default function PwaRegistrar() {
  useEffect(() => {
    if (!import.meta.env.PROD) return

    toast.dismiss('pwa-update')

    registerSW({
      immediate: true,
      onRegistered(registration) {
        console.info('[Aura Syncro PWA] Service Worker registrato:', registration?.scope)
      },
      onRegisterError(error) {
        console.error('[Aura Syncro PWA] Errore registrazione Service Worker:', error)
      },
    })
  }, [])

  return null
}
