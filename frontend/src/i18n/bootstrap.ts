import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const STORAGE_KEY = 'aura-lang'

/** Codice i18n Canarie — non usare `es-cn` (BCP47 = Spagnolo/Cina → fallback su `es`). */
export const CANARIAS_LOCALE = 'es-can' as const

/** Prefisso URL SEO landing Canarie (invariato). */
export const CANARIAS_HOME_PATH = '/es-cn' as const

const SUPPORTED = ['it', 'en', 'es', CANARIAS_LOCALE, 'fr', 'de'] as const
export type SupportedLocale = (typeof SUPPORTED)[number]

import itLocale from './locales/it.json'

const EAGER_LOCALE_BUNDLES: Partial<Record<SupportedLocale, Record<string, unknown>>> = {
  it: itLocale as Record<string, unknown>,
}

const localeLoaders: Record<SupportedLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  it: () => import('./locales/it.json'),
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
  [CANARIAS_LOCALE]: () => import('./locales/es-cn.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
}

function isSupportedLocale(code: string): code is SupportedLocale {
  return (SUPPORTED as readonly string[]).includes(code)
}

/** Normalizza codici legacy salvati in localStorage. */
export function normalizeLocaleCode(code: string | null | undefined): SupportedLocale | null {
  if (!code) return null
  if (code === 'es-cn' || code === 'es-CN') return CANARIAS_LOCALE
  return isSupportedLocale(code) ? code : null
}

export function localeFromPath(pathname: string): SupportedLocale | null {
  if (pathname === CANARIAS_HOME_PATH || pathname.startsWith(`${CANARIAS_HOME_PATH}/`)) {
    return CANARIAS_LOCALE
  }
  if (pathname === '/es' || pathname.startsWith('/es/')) return 'es'
  if (pathname === '/it' || pathname.startsWith('/it/')) return 'it'
  return null
}

function getBrowserLang(): SupportedLocale {
  if (typeof window === 'undefined') return 'it'
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.includes('canar') || browserLang.includes('ic')) return CANARIAS_LOCALE
  if (browserLang.includes('es')) return 'es'
  const shortCode = browserLang.split('-')[0]
  return isSupportedLocale(shortCode) ? shortCode : 'it'
}

export function resolveInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'it'
  const fromPath = localeFromPath(window.location.pathname)
  if (fromPath) return fromPath
  const saved = normalizeLocaleCode(localStorage.getItem(STORAGE_KEY))
  if (saved) return saved
  return getBrowserLang()
}

async function loadLocaleBundle(lng: SupportedLocale) {
  if (i18n.hasResourceBundle(lng, 'translation')) return
  const mod = await localeLoaders[lng]()
  i18n.addResourceBundle(lng, 'translation', mod.default, true, true)
}

/** Carica il bundle e applica la lingua — obbligatorio prima di changeLanguage per locale lazy. */
export async function applyLocale(locale: string): Promise<void> {
  const normalized = normalizeLocaleCode(locale) ?? locale
  if (!isSupportedLocale(normalized)) return
  await loadLocaleBundle(normalized)
  if (i18n.language !== normalized) {
    await i18n.changeLanguage(normalized)
  }
  document.documentElement.lang = normalized.split('-')[0]
  localStorage.setItem(STORAGE_KEY, normalized)
}

let bootstrapped = false

function attachI18nListeners() {
  i18n.on('languageChanged', (lng) => {
    const normalized = normalizeLocaleCode(lng) ?? lng
    document.documentElement.lang = normalized.split('-')[0]
    localStorage.setItem(STORAGE_KEY, normalized)
    if (isSupportedLocale(normalized)) void loadLocaleBundle(normalized)
  })
}

/**
 * Init sincrono — nessun await prima del first paint.
 * IT nel bundle; altre lingue caricate subito dopo il render.
 */
export function bootstrapI18nSync(): void {
  if (bootstrapped) return
  bootstrapped = true

  const initial = resolveInitialLocale()
  const eager = EAGER_LOCALE_BUNDLES[initial]
  const itTranslation = EAGER_LOCALE_BUNDLES.it!
  const resources: Record<string, { translation: Record<string, unknown> }> = {
    it: { translation: itTranslation },
  }
  if (eager && initial !== 'it') {
    resources[initial] = { translation: eager }
  }

  void i18n.use(initReactI18next).init({
    resources,
    lng: eager ? initial : 'it',
    fallbackLng: {
      [CANARIAS_LOCALE]: ['it'],
      es: ['it'],
      default: ['it'],
    },
    supportedLngs: [...SUPPORTED],
    nonExplicitSupportedLngs: false,
    cleanCode: false,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
  })

  document.documentElement.lang = (eager ? initial : 'it').split('-')[0]
  attachI18nListeners()

  if (!eager) {
    void applyLocale(initial)
  } else if (initial !== 'it') {
    void loadLocaleBundle('it')
  }
}


export default i18n
