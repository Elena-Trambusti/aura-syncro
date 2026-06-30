/** Aura Syncro — sistema icone fine-line (Lucide). */

export const AURA_ICON_STROKE = {
  /** Default UI — ultra-sottile */
  fine: 1.25,
  /** Voce attiva, hover enfasi */
  active: 1.5,
  /** Feature card, hero, gallery */
  display: 1.35,
} as const

export type AuraIconWeight = keyof typeof AURA_ICON_STROKE

export const AURA_ICON_SIZE = {
  '2xs': 'h-2.5 w-2.5',
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  nav: 'h-[17px] w-[17px]',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
  '2xl': 'h-9 w-9',
  hero: 'h-10 w-10',
} as const

export type AuraIconSize = keyof typeof AURA_ICON_SIZE

export function auraIconStroke(weight: AuraIconWeight = 'fine', active = false): number {
  return AURA_ICON_STROKE[active ? 'active' : weight]
}
