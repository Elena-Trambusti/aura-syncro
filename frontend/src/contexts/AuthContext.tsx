import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import i18n from '../i18n'
import { api, setTenantHeader } from '../lib/api'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { applyTenantCssVars } from '../lib/tenantTheme'
import { invalidateTenantQueries, queryClient } from '../lib/queryClient'
import { clearAuthCache, readAuthCache, writeAuthCache } from '../lib/authCache'
import { tenantIdentity, tenantIdentityKey } from '../lib/tenantSync'
import type { CountryCode, FiscalRegime, TaxRegion } from '../lib/fiscalRegime'
import { DEFAULT_FISCAL_REGIME, resolveFiscalRegime } from '../lib/fiscalRegime'

interface User {
  id: string
  name: string
  email: string
  role: string
}

export interface Restaurant extends FiscalRegime {
  id: string
  name: string
  slug: string
  colorTheme: string
  logoUrl?: string | null
  timezone?: string
  /** Mock freemium — true solo con abbonamento Stripe attivo */
  hasActiveSubscription: boolean
  /** Concierge onboarding completato dal team */
  isSetupComplete: boolean
  /** Piano moduli: BASE (core) o PRO (avanzato) */
  planTier: 'BASE' | 'PRO'
}

interface AuthContextType {
  user: User | null
  restaurant: Restaurant | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string, restaurantSlug?: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshRestaurant: () => Promise<void>
  /** Aggiorna l'intero tenant attivo (id + regime fiscale) e invalida cache */
  switchActiveRestaurant: (restaurant: Restaurant) => void
}

export interface RegisterData {
  restaurantName: string
  name: string
  email: string
  password: string
  phone?: string
  countryCode?: CountryCode
  taxRegion?: TaxRegion
}

const AuthContext = createContext<AuthContextType | null>(null)
const LANG_KEY = 'aura-lang'

function normalizeRestaurant(raw: Record<string, unknown>): Restaurant {
  const fiscal = resolveFiscalRegime(raw as Partial<FiscalRegime>)
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    colorTheme: String(raw.colorTheme || '#c9a227'),
    logoUrl: (raw.logoUrl as string | null | undefined) ?? null,
    timezone: raw.timezone ? String(raw.timezone) : fiscal.timezone,
    hasActiveSubscription: raw.hasActiveSubscription === true,
    isSetupComplete: raw.isSetupComplete === true,
    planTier: raw.planTier === 'PRO' ? 'PRO' : 'BASE',
    ...fiscal,
  }
}

/** Solo al primo accesso: imposta lingua UI dal defaultLocale del tenant se l'utente non ha scelto */
function applyRestaurantLocaleOnFirstVisit(defaultLocale?: string) {
  if (!defaultLocale) return
  const saved = localStorage.getItem(LANG_KEY)
  if (!saved) {
    i18n.changeLanguage(defaultLocale)
    localStorage.setItem(LANG_KEY, defaultLocale)
  }
}

function applyActiveRestaurant(
  normalized: Restaurant,
  options?: { invalidateCache?: boolean; previousKey?: string | null },
) {
  setTenantHeader(normalized.id)
  applyTenantCssVars(normalized.colorTheme)

  const nextKey = tenantIdentityKey(tenantIdentity(normalized))
  if (options?.invalidateCache !== false && options?.previousKey && options.previousKey !== nextKey) {
    invalidateTenantQueries(tenantIdentityKey(tenantIdentity(normalized)))
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hasStoredToken = !!localStorage.getItem('token')
  const cachedBoot = hasStoredToken ? readAuthCache() : null
  if (hasStoredToken && cachedBoot) {
    setTenantHeader(cachedBoot.restaurant.id)
  }
  const [user, setUser] = useState<User | null>(cachedBoot?.user ?? null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(cachedBoot?.restaurant ?? null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(() => {
    const storedToken = localStorage.getItem('token')
    return !!storedToken && !cachedBoot
  })
  const tenantKeyRef = useRef<string | null>(
    cachedBoot ? tenantIdentityKey(tenantIdentity(cachedBoot.restaurant)) : null,
  )

  const commitRestaurant = useCallback((normalized: Restaurant, invalidateCache = true) => {
    const previousKey = tenantKeyRef.current
    setRestaurant(normalized)
    applyActiveRestaurant(normalized, { invalidateCache, previousKey })
    tenantKeyRef.current = tenantIdentityKey(tenantIdentity(normalized))
  }, [])

  const setAuth = useCallback((data: { token: string; user: User; restaurant: Record<string, unknown> }) => {
    const normalized = normalizeRestaurant(data.restaurant)
    localStorage.setItem('token', data.token)
    queryClient.clear()
    setToken(data.token)
    setUser(data.user)
    commitRestaurant(normalized, true)
    writeAuthCache(data.user, normalized)
    applyRestaurantLocaleOnFirstVisit(normalized.defaultLocale)
    connectSocket(data.token)
  }, [commitRestaurant])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    clearAuthCache()
    setTenantHeader(null)
    setToken(null)
    setUser(null)
    setRestaurant(null)
    tenantKeyRef.current = null
    queryClient.clear()
    applyTenantCssVars('#c9a227')
    disconnectSocket()
  }, [])

  const refreshRestaurant = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      const normalized = normalizeRestaurant(res.data.restaurant)
      setUser(res.data.user)
      commitRestaurant(normalized, true)
      writeAuthCache(res.data.user, normalized)
    } catch {
      /* polling onboarding: ignora errori transitori; 401 gestito dall'interceptor */
    }
  }, [commitRestaurant])

  const switchActiveRestaurant = useCallback((next: Restaurant) => {
    const normalized = normalizeRestaurant(next as unknown as Record<string, unknown>)
    commitRestaurant(normalized, true)
  }, [commitRestaurant])

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setIsLoading(false)
      clearAuthCache()
      return
    }

    const cached = readAuthCache()
    if (cached) {
      setTenantHeader(cached.restaurant.id)
      applyTenantCssVars(cached.restaurant.colorTheme)
      connectSocket(storedToken)
    }

    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user)
        const normalized = normalizeRestaurant(res.data.restaurant)
        commitRestaurant(normalized, false)
        writeAuthCache(res.data.user, normalized)
        if (!cached) connectSocket(storedToken)
      })
      .catch(() => logout())
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    applyTenantCssVars(restaurant?.colorTheme)
  }, [restaurant?.colorTheme])

  const login = async (email: string, password: string, restaurantSlug?: string) => {
    const res = await api.post('/auth/login', {
      email,
      password,
      ...(restaurantSlug ? { restaurantSlug } : {}),
    })
    setAuth(res.data)
  }

  const register = async (data: RegisterData) => {
    const res = await api.post('/auth/register', data)
    setAuth(res.data)
  }

  return (
    <AuthContext.Provider value={{
      user,
      restaurant,
      token,
      isLoading,
      login,
      register,
      logout,
      refreshRestaurant,
      switchActiveRestaurant,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenantTheme() {
  const { restaurant } = useAuth()
  return restaurant?.colorTheme ?? '#c9a227'
}

/**
 * Regime fiscale dal tenant attivo (DB) — MAI dalla lingua UI (i18n).
 * Usare per calcoli, label legali (tRegime) e regole di business.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFiscalRegime(): FiscalRegime {
  const { restaurant } = useAuth()
  if (!restaurant) return DEFAULT_FISCAL_REGIME
  return {
    countryCode: restaurant.countryCode,
    taxRegion: restaurant.taxRegion,
    taxRate: restaurant.taxRate,
    taxName: restaurant.taxName,
    defaultLocale: restaurant.defaultLocale,
    timezone: restaurant.timezone,
    taxId: restaurant.taxId,
  }
}

/** Stato abbonamento e tier di accesso dashboard */
// eslint-disable-next-line react-refresh/only-export-components
export function useSubscription() {
  const { restaurant } = useAuth()
  const tier =
    !restaurant?.hasActiveSubscription
      ? 'unsubscribed'
      : !restaurant?.isSetupComplete
        ? 'onboarding'
        : 'operational'

  return {
    hasActiveSubscription: restaurant?.hasActiveSubscription ?? false,
    isSetupComplete: restaurant?.isSetupComplete ?? false,
    accessTier: tier,
    needsConciergeOnboarding: tier === 'onboarding',
    isOperational: tier === 'operational',
    planTier: restaurant?.planTier ?? 'BASE',
    hasProPlan: restaurant?.hasActiveSubscription === true || restaurant?.planTier === 'PRO',
  }
}

/** Chiave tenant per queryKey React Query — invalida cache al cambio ristorante/regime */
// eslint-disable-next-line react-refresh/only-export-components
export function useTenantQueryKey(): string {
  const { restaurant } = useAuth()
  return tenantIdentityKey(tenantIdentity(restaurant))
}
