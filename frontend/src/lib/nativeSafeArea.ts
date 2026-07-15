const MIN_TOP_PX = 28
/** Barra navigazione gesture Android (48dp) + margine per evitare overlap col profilo utente */
const MIN_BOTTOM_PX = 56

function measureEnvInset(edge: 'top' | 'bottom'): number {
  if (typeof document === 'undefined') return 0
  const probe = document.createElement('div')
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    `padding-${edge}:env(safe-area-inset-${edge},0px)`,
  ].join(';')
  document.documentElement.appendChild(probe)
  const raw = getComputedStyle(probe).getPropertyValue(`padding-${edge}`)
  probe.remove()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Imposta --safe-top / --safe-bottom con fallback per WebView/TWA (env spesso 0). */
export function applyNativeSafeAreaVars(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const top = Math.max(measureEnvInset('top'), MIN_TOP_PX)
  const bottom = Math.max(measureEnvInset('bottom'), MIN_BOTTOM_PX)
  root.style.setProperty('--safe-top', `${top}px`)
  root.style.setProperty('--safe-bottom', `${bottom}px`)
}
