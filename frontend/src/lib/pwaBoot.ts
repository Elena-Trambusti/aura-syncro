/** Pulisce SW e cache Workbox — causa #1 dello schermo nero su APK dopo deploy. */
export async function purgePwaRuntimeCaches(): Promise<void> {
  if (typeof window === 'undefined') return
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
}

export function hidePwaBootShell(): void {
  document.getElementById('pwa-boot-shell')?.remove()
  document.getElementById('static-landing-fcp')?.remove()
}

export function showPwaBootShell(message?: string): void {
  const shell = document.getElementById('pwa-boot-shell')
  if (!shell) return
  shell.style.display = 'flex'
  if (message) {
    const msg = shell.querySelector<HTMLElement>('[data-boot-msg]')
    if (msg) msg.textContent = message
  }
}

declare global {
  interface Window {
    __auraResetApp?: () => void
  }
}

export function installPwaResetGlobal(): void {
  window.__auraResetApp = () => {
    void purgePwaRuntimeCaches().finally(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
      window.location.replace('/login?pwa=1')
    })
  }
}
