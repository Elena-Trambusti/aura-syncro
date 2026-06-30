import i18n from './bootstrap'

export const LOCALE_MAP: Record<string, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

export function getIntlLocale(): string {
  const code = i18n.language?.split('-')[0] || 'it'
  return LOCALE_MAP[code] || 'it-IT'
}

/** Locale per formattazione fiscale (date/valuta) — legge dal regime del ristorante, non dalla lingua UI. */
export function getFiscalIntlLocale(defaultLocale?: string | null): string {
  const code = (defaultLocale || 'it').split('-')[0]
  return LOCALE_MAP[code] || 'it-IT'
}
