/** Token JWT in memoria + sessionStorage (sopravvive a F5, non a localStorage/XSS persistente). */
let memoryToken: string | null = null

const LEGACY_KEY = 'token'
const SESSION_KEY = 'aura_session_token'

/** Migrazione one-shot da localStorage legacy. */
export function bootstrapSessionToken(): string | null {
  if (memoryToken) return memoryToken
  if (typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      memoryToken = stored
      return stored
    }
  }
  const legacy = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null
  if (legacy) {
    memoryToken = legacy
    localStorage.removeItem(LEGACY_KEY)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, legacy)
    }
  }
  return memoryToken
}

export function getSessionToken(): string | null {
  return memoryToken ?? bootstrapSessionToken()
}

export function setSessionToken(token: string | null): void {
  memoryToken = token
  if (typeof sessionStorage !== 'undefined') {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_KEY)
  }
}

export function clearSessionToken(): void {
  setSessionToken(null)
}
