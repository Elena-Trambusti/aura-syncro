import { registerSW } from 'virtual:pwa-register'

/** Registrazione esplicita SW — log in console per debug PWA/push */
export const updateServiceWorker = registerSW({
  immediate: true,
  onRegistered(registration) {
    console.info('[Aura Syncro PWA] Service Worker registrato:', registration?.scope)
  },
  onRegisterError(error) {
    console.error('[Aura Syncro PWA] Errore registrazione Service Worker:', error)
  },
})
