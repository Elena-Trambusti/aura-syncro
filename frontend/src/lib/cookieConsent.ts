/** Consenso cookie / analytics — ePrivacy + GDPR */

export const COOKIE_CONSENT_KEY = 'aura-cookie-consent'
export const COOKIE_CONSENT_EVENT = 'aura-cookie-consent-change'

/** `all` = analytics + error monitoring; `necessary` = solo tecnici */
export type CookieConsentLevel = 'all' | 'necessary'

function normalizeLegacy(raw: string | null): CookieConsentLevel | null {
  if (!raw) return null
  if (raw === 'all' || raw === 'accepted') return 'all'
  if (raw === 'necessary' || raw === 'declined') return 'necessary'
  return null
}

export function getCookieConsent(): CookieConsentLevel | null {
  if (typeof window === 'undefined') return null
  return normalizeLegacy(localStorage.getItem(COOKIE_CONSENT_KEY))
}

export function setCookieConsent(level: CookieConsentLevel): void {
  localStorage.setItem(COOKIE_CONSENT_KEY, level)
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: level }))
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === 'all'
}

export function subscribeCookieConsent(listener: (level: CookieConsentLevel | null) => void): () => void {
  const handler = () => listener(getCookieConsent())
  window.addEventListener(COOKIE_CONSENT_EVENT, handler)
  return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handler)
}
