import { BRAND_ASSETS_VERSION } from './brand'

const v = `?v=${BRAND_ASSETS_VERSION}`

/** Sfondo marmo landing — WebP responsive (LCP) */
export const LANDING_MARBLE = {
  mobile: `/assets/marble-bg-768.webp${v}`,
  desktop: `/assets/marble-bg-1920.webp${v}`,
  fallback: `/assets/marble-bg.png${v}`,
} as const

/** Pianta tavoli 2.5D — sezione below-fold */
export const LANDING_FLOOR_PLAN = {
  mobile: `/brand/tavoli-floor-plan-25d-680.webp${v}`,
  desktop: `/brand/tavoli-floor-plan-25d.webp${v}`,
  fallback: `/brand/tavoli-floor-plan-25d.png${v}`,
} as const
