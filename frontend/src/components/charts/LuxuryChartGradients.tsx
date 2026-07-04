import { useId } from 'react'
import { BRAND } from '../../lib/brand'
import {
  ACCENT_GRADIENT_MID,
  ACCENT_GRADIENT_TOP,
  type LuxuryChartAccent,
} from './luxuryChartTheme'

export function useLuxuryGradientId(accent: LuxuryChartAccent = 'gold') {
  const rawId = useId()
  const areaId = `luxury-area-${accent}${rawId.replace(/:/g, '')}`
  const barId = `luxury-bar-${accent}${rawId.replace(/:/g, '')}`
  return { areaId, barId }
}

export function LuxuryAreaGradientDef({
  id,
  accent = 'gold',
  fadeToBlack = true,
}: { id: string; accent?: LuxuryChartAccent; fadeToBlack?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={ACCENT_GRADIENT_TOP[accent]} />
      <stop offset="45%" stopColor={ACCENT_GRADIENT_MID[accent]} />
      <stop
        offset="100%"
        stopColor={fadeToBlack ? BRAND.navy : ACCENT_GRADIENT_MID[accent]}
        stopOpacity={fadeToBlack ? 1 : 0}
      />
    </linearGradient>
  )
}

export function LuxuryBarGradientDef({
  id,
  accent = 'gold',
}: { id: string; accent?: LuxuryChartAccent }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={ACCENT_GRADIENT_TOP[accent]} />
      <stop offset="100%" stopColor={ACCENT_GRADIENT_MID[accent]} stopOpacity={0.85} />
    </linearGradient>
  )
}
