/** URL canonico del sito marketing — sempre con www. */
export const SITE_ORIGIN = 'https://www.aurasyncro.com'

export const OG_IMAGE_URL = `${SITE_ORIGIN}/brand/aura-syncro-logo-transparent.png?v=3`

/** Profili social pubblici — compilare quando disponibili (migliora SEO social). */
export const SITE_SOCIAL = {
  linkedIn: undefined as string | undefined,
  instagram: undefined as string | undefined,
} as const

export function absoluteSiteUrl(path = '/'): string {
  if (!path || path === '/') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

/** Alternate hreflang per le landing localizzate. */
export const LANDING_HREFLANG_ALTERNATES = [
  { hreflang: 'x-default', path: '/' },
  { hreflang: 'it', path: '/' },
  { hreflang: 'it-IT', path: '/it' },
  { hreflang: 'es', path: '/es' },
  { hreflang: 'es-ES', path: '/es' },
  { hreflang: 'es-CN', path: '/es-cn' },
] as const

const OG_LOCALE_MAP: Record<string, string> = {
  it: 'it_IT',
  en: 'en_US',
  es: 'es_ES',
  'es-cn': 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
}

export function ogLocaleForLanguage(lang: string): string {
  return OG_LOCALE_MAP[lang] ?? 'it_IT'
}
