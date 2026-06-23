import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'

/**
 * Registra il Service Worker in produzione.
 * Aggiornamenti silenziosi (autoUpdate) + reload quando un nuovo worker prende il controllo.
 */
export default function PwaRegistrar() {
  useEffect(() => {
    if (!import.meta.env.PROD) return

    toast.dismiss('pwa-update')

    const onControllerChange = () => {
      window.location.reload()
    }
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)

    registerSW({
      immediate: true,
      onRegistered(registration) {
        console.info('[Aura Syncro PWA] Service Worker registrato:', registration?.scope)
        void registration?.update()
      },
      onRegisterError(error) {
        console.error('[Aura Syncro PWA] Errore registrazione Service Worker:', error)
      },
    })

    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
