/** Token JWT in memoria — non persistito in localStorage (mitigazione XSS). */
let memoryToken: string | null = null

const LEGACY_KEY = 'token'

/** Migrazione one-shot da localStorage legacy. */
export function bootstrapSessionToken(): string | null {
  if (memoryToken) return memoryToken
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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_KEY)
  }
}

export function clearSessionToken(): void {
  setSessionToken(null)
}
