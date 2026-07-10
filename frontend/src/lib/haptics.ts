type HapticPattern = 'soft' | 'medium' | 'success' | 'warning'

const PATTERN_MAP: Record<HapticPattern, number | number[]> = {
  soft: 12,
  medium: 20,
  success: [10, 40, 18],
  warning: [20, 50, 20],
}

/** Trigger aptic feedback where supported (mostly Android browsers/PWA). */
export function triggerHaptic(pattern: HapticPattern = 'soft'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  const isStandalone =
    typeof window !== 'undefined'
    && (window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true)

  // Keep haptics subtle, primarily in installed app mode.
  if (!isStandalone && pattern !== 'warning') return
  navigator.vibrate(PATTERN_MAP[pattern])
}
