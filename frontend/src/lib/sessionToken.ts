/** Token JWT in memoria (API usa cookie httpOnly; Bearer solo per socket finché non migriamo auth socket). */
let memoryToken: string | null = null

const LEGACY_KEY = 'token'
const SESSION_KEY = 'aura_session_token'

function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => c.trim().startsWith('aura_session='))
}

/** Migrazione one-shot da sessionStorage/localStorage legacy — non persiste più il token. */
export function bootstrapSessionToken(): string | null {
  if (memoryToken) return memoryToken
  if (typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      sessionStorage.removeItem(SESSION_KEY)
      memoryToken = stored
      return stored
    }
  }
  const legacy = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null
  if (legacy) {
    memoryToken = legacy
    localStorage.removeItem(LEGACY_KEY)
  }
  return memoryToken
}

export function getSessionToken(): string | null {
  return memoryToken ?? bootstrapSessionToken()
}

export function setSessionToken(token: string | null): void {
  memoryToken = token
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY)
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_KEY)
  }
}

export function clearSessionToken(): void {
  setSessionToken(null)
}

/** Hint per bootstrap auth: cache locale o cookie sessione httpOnly. */
export function hasAuthSessionHint(cachedRestaurantId?: string | null): boolean {
  return Boolean(cachedRestaurantId || getSessionToken() || hasSessionCookie())
}
