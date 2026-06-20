import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import it from './locales/it.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import de from './locales/de.json'

const STORAGE_KEY = 'aura-lang'

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'it'
const supported = ['it', 'en', 'es', 'fr', 'de'] as const
const initial = saved && supported.includes(saved as (typeof supported)[number])
  ? saved
  : supported.includes(browserLang as (typeof supported)[number])
    ? browserLang
    : 'it'

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: initial,
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.split('-')[0]
  localStorage.setItem(STORAGE_KEY, lng.split('-')[0])
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

export default i18n
