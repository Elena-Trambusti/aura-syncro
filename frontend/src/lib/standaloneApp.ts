/** App installata (PWA standalone o APK/TWA) — senza barra indietro del browser. */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
  )
}
