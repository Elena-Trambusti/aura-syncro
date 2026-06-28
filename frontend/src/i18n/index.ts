import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import it from './locales/it.json'
import en from './locales/en.json'
import es from './locales/es.json'
import esCn from './locales/es-cn.json'
import fr from './locales/fr.json'
import de from './locales/de.json'

const STORAGE_KEY = 'aura-lang'

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
const supported = ['it', 'en', 'es', 'es-cn', 'fr', 'de'] as const
type SupportedLocale = (typeof supported)[number]

function isSupportedLocale(code: string): code is SupportedLocale {
  return (supported as readonly string[]).includes(code)
}

// Auto-detect browser language if not saved
const getBrowserLang = () => {
  if (typeof window === 'undefined') return 'it'
  const browserLang = navigator.language.toLowerCase() // es-ES, it-IT
  
  if (browserLang.includes('es')) {
    // Check timezone to guess if Canary Islands (though tricky, we fallback to es)
    // If they explicitly selected es-cn, it will be in localStorage.
    return 'es' 
  }
  
  const shortCode = browserLang.split('-')[0]
  return isSupportedLocale(shortCode) ? shortCode : 'it'
}

const initial = saved && supported.includes(saved as (typeof supported)[number]) ? saved : getBrowserLang()

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
    es: { translation: es },
    'es-cn': { translation: esCn },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: initial,
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.split('-')[0]
  localStorage.setItem(STORAGE_KEY, lng) // <-- Keep full code like 'es-cn'
})

document.documentElement.lang = initial

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

export default i18n
