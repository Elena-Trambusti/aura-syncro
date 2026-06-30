import axios from 'axios'
import { toast } from '@/lib/toast'
import { resolveApiBaseUrl } from './backendUrl'
import { isPublicAppRoute } from './publicRoutes'
import { readAuthCache } from './authCache'
import { isDemoUserEmail } from './demoAccounts'
import { isDemoMutationAllowed } from './demoRestrictions'
import { getSessionToken, clearSessionToken } from './sessionToken'

const RESTAURANT_ID_KEY = 'restaurantId'

function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}

export { getApiBaseUrl }

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,
})

export function setTenantHeader(restaurantId: string | null) {
  if (restaurantId) {
    localStorage.setItem(RESTAURANT_ID_KEY, restaurantId)
  } else {
    localStorage.removeItem(RESTAURANT_ID_KEY)
  }
}

api.interceptors.request.use(config => {
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
    toast.warning('In modalità Demo puoi interagire solo con la sezione Tavoli.', {
      className: 'aura-sonner-toast--demo',
      duration: 4500,
    })
    return Promise.reject(new axios.CanceledError('DEMO_READ_ONLY'))
  }

  return config
})

api.interceptors.response.use(
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
      toast.warning(err.response.data.error || 'Azione non consentita in modalità Demo.', {
        className: 'aura-sonner-toast--demo',
        duration: 4500,
      })
    }
    return Promise.reject(err)
  }
)
