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

export const BRAND_LOGO_GRADIENT = `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.amber})`

/** Colori PWA — barra di stato allineata al navy premium */
export const PWA = {
  themeColor: '#E5A93C',
  backgroundColor: '#030712',
} as const
