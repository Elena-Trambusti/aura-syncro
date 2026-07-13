import { api } from './api'
import { isStandaloneApp, markInstalledAppShell } from './standaloneApp'
import { applyNativeSafeAreaVars } from './nativeSafeArea'

/** Segna la shell; il redirect marketing → login è in index.html + LandingRoute (no reload qui). */
export function bootstrapStandaloneApp(): void {
  if (typeof window === 'undefined') return
  if (!isStandaloneApp()) return

  markInstalledAppShell()
  const root = document.documentElement
  root.classList.add('pwa-standalone', 'aura-native-shell')
  applyNativeSafeAreaVars()

  window.addEventListener('resize', applyNativeSafeAreaVars, { passive: true })
  window.visualViewport?.addEventListener('resize', applyNativeSafeAreaVars, { passive: true })
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
