import i18n from './bootstrap'
import type { SupportedLocale } from './bootstrap'

export const LOCALE_MAP: Record<string, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
  'es-cn': 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

/** Rotte landing con prefisso lingua SEO. */
export const LOCALE_HOME_PATHS = ['/', '/it', '/es', '/es-cn'] as const

export function getIntlLocale(): string {
  const code = i18n.language || 'it'
  return LOCALE_MAP[code] || LOCALE_MAP[code.split('-')[0]] || 'it-IT'
}

/** Locale per formattazione fiscale (date/valuta) — legge dal regime del ristorante, non dalla lingua UI. */
export function getFiscalIntlLocale(defaultLocale?: string | null): string {
  const code = (defaultLocale || 'it').split('-')[0]
  return LOCALE_MAP[code] || 'it-IT'
}

/** Rimuove prefisso /it, /es, /es-cn dal path (es-cn prima di es). */
export function stripLocalePrefix(pathname: string): string {
  if (pathname === '/es-cn' || pathname.startsWith('/es-cn/')) {
    return pathname.slice('/es-cn'.length) || '/'
  }
  if (pathname === '/es' || pathname.startsWith('/es/')) {
    return pathname.slice('/es'.length) || '/'
  }
  if (pathname === '/it' || pathname.startsWith('/it/')) {
    return pathname.slice('/it'.length) || '/'
  }
  return pathname
}

export function localeFromPath(pathname: string): SupportedLocale | null {
  if (pathname === '/es-cn' || pathname.startsWith('/es-cn/')) return 'es-cn'
  if (pathname === '/es' || pathname.startsWith('/es/')) return 'es'
  if (pathname === '/it' || pathname.startsWith('/it/')) return 'it'
  return null
}

export function isLocaleHomePath(pathname: string): boolean {
  return (LOCALE_HOME_PATHS as readonly string[]).includes(pathname)
}

/** Path SEO per cambio lingua sulla landing (null = solo i18n, es. dashboard). */
export function localePathForSwitch(locale: SupportedLocale, pathname: string): string | null {
  if (!isLocaleHomePath(pathname)) return null

  const suffix = stripLocalePrefix(pathname)
  const tail = suffix === '/' ? '' : suffix

  switch (locale) {
    case 'it':
      return `/it${tail}`
    case 'es':
      return `/es${tail}`
    case 'es-cn':
      return `/es-cn${tail}`
    default:
      return null
  }
}
