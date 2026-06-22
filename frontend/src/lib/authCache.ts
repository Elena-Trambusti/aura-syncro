import type { Restaurant } from '../contexts/AuthContext'

const AUTH_CACHE_KEY = 'aura-auth-cache'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthCachePayload {
  user: AuthUser
  restaurant: Restaurant
  cachedAt: number
}

export function readAuthCache(): AuthCachePayload | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthCachePayload
    if (!parsed?.user?.id || !parsed?.restaurant?.id) return null
    if (Date.now() - parsed.cachedAt > MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeAuthCache(user: AuthUser, restaurant: Restaurant): void {
  try {
    const payload: AuthCachePayload = { user, restaurant, cachedAt: Date.now() }
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload))
  } catch {
    /* quota piena o storage disabilitato */
  }
}

export function clearAuthCache(): void {
  localStorage.removeItem(AUTH_CACHE_KEY)
}
