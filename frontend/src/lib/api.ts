import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { toast } from '@/lib/toast'
import i18n from '../i18n'
import { resolveApiBaseUrl } from './backendUrl'
import { isPublicAppRoute } from './publicRoutes'
import { readAuthCache } from './authCache'
import { isDemoUserEmail } from './demoAccounts'
import { isDemoMutationAllowed } from './demoRestrictions'
import { getSessionToken, clearSessionToken } from './sessionToken'
import { resolveApiErrorMessage } from './apiError'

const RESTAURANT_ID_KEY = 'restaurantId'

/** Evita toast ripetuti quando più query/poll falliscono insieme. */
let lastNetworkErrorToastAt = 0
const NETWORK_ERROR_TOAST_COOLDOWN_MS = 30_000

function showNetworkErrorToast(): void {
  const now = Date.now()
  if (now - lastNetworkErrorToastAt < NETWORK_ERROR_TOAST_COOLDOWN_MS) return
  lastNetworkErrorToastAt = now
  toast.error(
    i18n.t('errors.networkError', {
      defaultValue: 'Impossibile contattare il server. Verifica la connessione.',
    }),
  )
}

function isAxiosCanceled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; name?: string; message?: string }
  return (
    e.code === 'ERR_CANCELED'
    || e.name === 'CanceledError'
    || e.message === 'DEMO_READ_ONLY'
  )
}

function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}

export { getApiBaseUrl }

export type AuraApiRequestConfig = AxiosRequestConfig & {
  /** Non mostrare toast di rete per richieste secondarie (es. layout pianta). */
  silentNetworkError?: boolean
}

let apiInstance: AxiosInstance | null = null
let initPromise: Promise<AxiosInstance> | null = null

async function initApi(): Promise<AxiosInstance> {
  const { default: axios } = await import('axios')
  const instance = axios.create({
    baseURL: getApiBaseUrl(),
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    withCredentials: true,
  })

  instance.interceptors.request.use(config => {
    const token = getSessionToken()
    if (token) config.headers.Authorization = `Bearer ${token}`

    const restaurantId = localStorage.getItem(RESTAURANT_ID_KEY)
    if (restaurantId) config.headers['X-Restaurant-Id'] = restaurantId

    const cachedUser = readAuthCache()?.user.email
    const method = (config.method || 'get').toUpperCase()
    const url = config.url || ''
    if (
      cachedUser &&
      isDemoUserEmail(cachedUser) &&
      !isDemoMutationAllowed(url, method)
    ) {
      toast.warning(i18n.t('demo.apiReadOnly'), {
        className: 'aura-sonner-toast--demo',
        duration: 4500,
      })
      return Promise.reject(new axios.CanceledError('DEMO_READ_ONLY'))
    }

    return config
  })

  instance.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) {
        clearSessionToken()
        localStorage.removeItem(RESTAURANT_ID_KEY)
        localStorage.removeItem('aura-auth-cache')

        const path = window.location.pathname
        if (!isPublicAppRoute(path)) {
          window.location.href = '/login'
        }
      } else if (err.response?.status === 403 && err.response?.data?.code === 'DEMO_READ_ONLY') {
        toast.warning(err.response.data.error || i18n.t('demo.apiForbidden'), {
          className: 'aura-sonner-toast--demo',
          duration: 4500,
        })
      } else if (isAxiosCanceled(err)) {
        // Richiesta annullata (navigazione, demo read-only, React Query abort) — nessun toast
      } else if (err.code === 'ECONNABORTED') {
        showNetworkErrorToast()
      } else if (!err.response) {
        const silent = (err.config as AuraApiRequestConfig | undefined)?.silentNetworkError
        if (!silent) showNetworkErrorToast()
      } else if (err.response.status >= 400 && err.response.status < 500) {
        const payload = err.response.data as { code?: string; error?: string } | undefined
        if (payload?.code) {
          ;(err as { translatedMessage?: string }).translatedMessage =
            resolveApiErrorMessage(i18n.t.bind(i18n), payload)
        }
      } else if (err.response.status >= 500) {
        toast.error(i18n.t('errors.serverError', { defaultValue: 'Errore del server. Riprova tra poco.' }))
      }
      return Promise.reject(err)
    },
  )

  apiInstance = instance
  return instance
}

function getApiInstance(): Promise<AxiosInstance> {
  if (apiInstance) return Promise.resolve(apiInstance)
  if (!initPromise) initPromise = initApi()
  return initPromise
}

/** Client HTTP — axios caricato solo alla prima richiesta API (landing senza sessione: zero download). */
export const api = {
  get<T = any>(url: string, config?: AuraApiRequestConfig): Promise<AxiosResponse<T>> {
    return getApiInstance().then(i => i.get<T>(url, config))
  },
  post<T = any>(url: string, data?: unknown, config?: AuraApiRequestConfig): Promise<AxiosResponse<T>> {
    return getApiInstance().then(i => i.post<T>(url, data, config))
  },
  put<T = any>(url: string, data?: unknown, config?: AuraApiRequestConfig): Promise<AxiosResponse<T>> {
    return getApiInstance().then(i => i.put<T>(url, data, config))
  },
  patch<T = any>(url: string, data?: unknown, config?: AuraApiRequestConfig): Promise<AxiosResponse<T>> {
    return getApiInstance().then(i => i.patch<T>(url, data, config))
  },
  delete<T = any>(url: string, config?: AuraApiRequestConfig): Promise<AxiosResponse<T>> {
    return getApiInstance().then(i => i.delete<T>(url, config))
  },
}

export function setTenantHeader(restaurantId: string | null) {
  if (restaurantId) {
    localStorage.setItem(RESTAURANT_ID_KEY, restaurantId)
  } else {
    localStorage.removeItem(RESTAURANT_ID_KEY)
  }
}
