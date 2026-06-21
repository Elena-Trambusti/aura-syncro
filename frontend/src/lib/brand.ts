/** Aura Syncro — brand tokens condivisi */
export const BRAND = {
  name: 'Aura Syncro',
  tagline: 'Sincronizza ogni istante del tuo ristorante',
  gold: '#C9A227',
  goldHover: '#B8921F',
  amber: '#D4A017',
  /** Sfondo app — grigio caldo, non nero puro */
  dark: '#181614',
  /** Sidebar / header */
  darkSurface: '#1f1d1a',
  /** Card e pannelli */
  darkElevated: '#262320',
  darkBorder: '#3d3832',
} as const

export const BRAND_LOGO_GRADIENT = `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.amber})`

/** Colori PWA — barra di stato / splash allineati al brand gold */
export const PWA = {
  themeColor: '#C9A227',
  backgroundColor: '#C9A227',
} as const
