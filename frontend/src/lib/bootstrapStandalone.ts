import { api } from './api'
import { detectInstalledAppShell } from './standaloneApp'

const MARKETING_PATHS = new Set(['/', '/it', '/es', '/es-cn'])

/** Segna la shell e reindirizza la landing marketing → login nell'APK/PWA. */
export function bootstrapStandaloneApp(): void {
  if (typeof window === 'undefined') return
  if (!detectInstalledAppShell()) return

  document.documentElement.classList.add('pwa-standalone')

  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (MARKETING_PATHS.has(path)) {
    window.location.replace('/login?pwa=1')
  }
}

/** Ripristino d'emergenza quando l'APK resta bloccato (cache SW / sessione corrotta). */
export async function resetStandaloneAppSession(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    await api.post('/auth/logout')
  } catch {
    /* offline o sessione già assente */
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch {
    /* best effort */
  }

  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    /* ignore */
  }

  window.location.replace('/login?pwa=1')
}
