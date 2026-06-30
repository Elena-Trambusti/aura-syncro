import { BRAND } from '../../lib/brand'

export type LuxuryChartAccent = 'gold' | 'violet' | 'emerald' | 'champagne'

export const LUXURY_CHART = {
  axis: BRAND.chartAxis,
  cursor: 'rgba(212, 175, 55, 0.35)',
  animationDuration: 1100,
  animationEasing: 'ease-out' as const,
} as const

export const ACCENT_STROKES: Record<LuxuryChartAccent, string> = {
  gold: BRAND.gold,
  violet: '#8B7CFF',
  emerald: '#34d399',
  champagne: BRAND.champagne,
}

export const ACCENT_GRADIENT_TOP: Record<LuxuryChartAccent, string> = {
  gold: 'rgba(212, 175, 55, 0.42)',
  violet: 'rgba(99, 91, 255, 0.35)',
  emerald: 'rgba(52, 211, 153, 0.32)',
  champagne: 'rgba(247, 231, 206, 0.28)',
}

export const ACCENT_GRADIENT_MID: Record<LuxuryChartAccent, string> = {
  gold: 'rgba(212, 175, 55, 0.12)',
  violet: 'rgba(99, 91, 255, 0.1)',
  emerald: 'rgba(52, 211, 153, 0.08)',
  champagne: 'rgba(247, 231, 206, 0.06)',
}

export const PIE_LUXURY_COLORS = [
  BRAND.gold,
  '#C9A227',
  '#8B7CFF',
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#a78bfa',
] as const
