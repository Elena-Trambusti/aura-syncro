const INSTALLED_FLAG_KEY = 'aura-installed-app'
/** Sessione TWA attiva (referrer android-app:// valido solo alla prima navigazione). */
const TWA_SESSION_KEY = 'aura-twa-active'

function hasPwaQueryFlag(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('pwa')
}

function isAndroidAppReferrer(): boolean {
  if (typeof document === 'undefined') return false
  return document.referrer.startsWith('android-app://')
}

function markTwaSession(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(TWA_SESSION_KEY, '1')
  } catch {
    /* storage disabilitato */
  }
}

function hasTwaSession(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(TWA_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function hasDisplayModeShell(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
  )
}

/** Segnala che il device ha usato PWA/APK almeno una volta. */
export function markInstalledAppShell(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(INSTALLED_FLAG_KEY, '1')
  } catch {
    /* storage disabilitato */
  }
}

function hasInstalledFlag(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(INSTALLED_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // WebView Android (TWA wrapper custom, APK con WebView, ecc.)
  return /; wv\)/i.test(ua) || /\bwv\b/i.test(ua)
}

/**
 * Shell embedded senza browser chrome (PWA/APK/TWA/WebView).
 * Include flag sessione TWA: il referrer android-app:// sparisce dopo la prima navigazione.
 */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  if (hasDisplayModeShell()) return true
  if (isAndroidAppReferrer()) {
    markTwaSession()
    return true
  }
  if (hasTwaSession()) return true
  if (hasPwaQueryFlag()) return true
  if (isAndroidWebView()) return true
  return false
}

/** Shell app o device che ha già usato l'app installata (bootstrap, recovery UI). */
export function isInstalledAppShell(): boolean {
  return isStandaloneApp() || hasInstalledFlag()
}

/** Rileva shell app e marca il device per le aperture future. */
export function detectInstalledAppShell(): boolean {
  const embedded = isStandaloneApp()
  if (embedded) markInstalledAppShell()
  return isInstalledAppShell()
}
