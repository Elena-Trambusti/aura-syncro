/** Aura Syncro — brand tokens condivisi (premium dark luxury) */
export const BRAND = {
  name: 'Aura Syncro',
  tagline: 'Sincronizza ogni istante del tuo ristorante',
  /** Oro caldo — accent primario */
  gold: '#D4AF37',
  goldMuted: '#B8921F',
  goldHover: '#E8C547',
  champagne: '#F7E7CE',
  amber: '#C9A227',
  /** Navy profondo — sfondo app */
  navy: '#0B0E14',
  navyMid: '#12151C',
  navyElevated: '#1A1D26',
  navySurface: '#22262F',
  /** Alias legacy */
  dark: '#0B0E14',
  darkSurface: '#12151C',
  darkElevated: '#1A1D26',
  darkBorder: 'rgba(255,255,255,0.08)',
  /** Testo */
  textPrimary: '#F4F4F5',
  textMuted: '#8B8B9E',
  /** Chart */
  chartGrid: 'rgba(255,255,255,0.06)',
  chartAxis: '#71717A',
} as const

/** Logo ufficiale — PNG oro con sfondo trasparente (master in /brand) */
export const BRAND_LOGO_PATH = '/brand/aura-syncro-app-icon.png'
export const BRAND_OG_IMAGE_PATH = '/og-image.jpg'
/** Bump quando cambiano asset logo / PWA */
export const BRAND_ASSETS_VERSION = '19'
export const BRAND_LOGO_VERSION = BRAND_ASSETS_VERSION
export const BRAND_LOGO_SRC = `${BRAND_LOGO_PATH}?v=${BRAND_LOGO_VERSION}`

/** Logo UI (badge, nav, toast) — WebP 112px, non il master 869px */
export const BRAND_LOGO_DISPLAY_PATH = '/brand/aura-syncro-logo-display.webp'
export const BRAND_LOGO_DISPLAY_SRC = `${BRAND_LOGO_DISPLAY_PATH}?v=${BRAND_ASSETS_VERSION}`

/** Sfondo marmo app/tavoli — WebP compresso */
export const MARBLE_BG_WEBP = `/assets/marble-bg.webp?v=${BRAND_ASSETS_VERSION}`

/** Favicon/PWA derivati dal master (rigenerati da generate-pwa-icons) */
export const BRAND_APP_ICON_PATH = '/favicon.png'
export const BRAND_APP_ICON_SRC = `${BRAND_APP_ICON_PATH}?v=${BRAND_LOGO_VERSION}`

export const BRAND_LOGO_GRADIENT = `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.amber})`

/** Colori PWA — splash allineato all'oro del logo (no bordi bianchi all'installazione) */
export const PWA = {
  themeColor: '#0B0E14',
  backgroundColor: '#C9A227',
} as const
