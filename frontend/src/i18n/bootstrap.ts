import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const STORAGE_KEY = 'aura-lang'
const SUPPORTED = ['it', 'en', 'es', 'es-cn', 'fr', 'de'] as const
export type SupportedLocale = (typeof SUPPORTED)[number]

import itLocale from './locales/it.json'

const EAGER_LOCALE_BUNDLES: Partial<Record<SupportedLocale, Record<string, unknown>>> = {
  it: itLocale as Record<string, unknown>,
}

const localeLoaders: Record<SupportedLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  it: () => import('./locales/it.json'),
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
  'es-cn': () => import('./locales/es-cn.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
}

function isSupportedLocale(code: string): code is SupportedLocale {
  return (SUPPORTED as readonly string[]).includes(code)
}

function localeFromPath(pathname: string): SupportedLocale | null {
  if (pathname === '/es-cn' || pathname.startsWith('/es-cn/')) return 'es-cn'
  if (pathname === '/es' || pathname.startsWith('/es/')) return 'es'
  if (pathname === '/it' || pathname.startsWith('/it/')) return 'it'
  return null
}

function getBrowserLang(): SupportedLocale {
  if (typeof window === 'undefined') return 'it'
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.includes('es')) return 'es'
  const shortCode = browserLang.split('-')[0]
  return isSupportedLocale(shortCode) ? shortCode : 'it'
}

export function resolveInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'it'
  const fromPath = localeFromPath(window.location.pathname)
  if (fromPath) return fromPath
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && isSupportedLocale(saved)) return saved
  return getBrowserLang()
}

async function loadLocaleBundle(lng: SupportedLocale) {
  if (i18n.hasResourceBundle(lng, 'translation')) return
  const mod = await localeLoaders[lng]()
  i18n.addResourceBundle(lng, 'translation', mod.default, true, true)
}

let bootstrapped = false

function attachI18nListeners() {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng.split('-')[0]
    localStorage.setItem(STORAGE_KEY, lng)
    if (isSupportedLocale(lng)) void loadLocaleBundle(lng)
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
    fallbackLng: 'it',
    interpolation: { escapeValue: false },
  })

  document.documentElement.lang = (eager ? initial : 'it').split('-')[0]
  attachI18nListeners()

  if (!eager) {
    void loadLocaleBundle(initial).then(() => {
      document.documentElement.lang = initial.split('-')[0]
      void i18n.changeLanguage(initial)
    })
  } else if (initial !== 'it') {
    void loadLocaleBundle('it')
  }
}

/** @deprecated Usare bootstrapI18nSync — mantenuto per test */
export async function bootstrapI18n(): Promise<void> {
  bootstrapI18nSync()
}

export default i18n
