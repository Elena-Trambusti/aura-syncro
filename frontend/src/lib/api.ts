import axios from 'axios'
import toast from 'react-hot-toast'
import { resolveApiBaseUrl } from './backendUrl'
import { isPublicAppRoute } from './publicRoutes'

const RESTAURANT_ID_KEY = 'restaurantId'

function getApiBaseUrl(): string {
  return resolveApiBaseUrl()
}

export { getApiBaseUrl }

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

export function setTenantHeader(restaurantId: string | null) {
  if (restaurantId) {
    localStorage.setItem(RESTAURANT_ID_KEY, restaurantId)
  } else {
    localStorage.removeItem(RESTAURANT_ID_KEY)
  }
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const restaurantId = localStorage.getItem(RESTAURANT_ID_KEY)
  if (restaurantId) config.headers['X-Restaurant-Id'] = restaurantId

  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem(RESTAURANT_ID_KEY)
      localStorage.removeItem('aura-auth-cache')

      const path = window.location.pathname
      if (!isPublicAppRoute(path)) {
        window.location.href = '/login'
      }
    } else if (err.response?.status === 403 && err.response?.data?.code === 'DEMO_READ_ONLY') {
      toast.error(err.response.data.error || 'Azione non consentita in modalità Demo.', {
        icon: '⚠️',
        style: {
          borderRadius: '10px',
          background: '#1e293b', // slate-800
          color: '#fcd34d', // amber-300
          border: '1px solid rgba(245, 158, 11, 0.2)', // amber-500/20
        },
      })
    }
    return Promise.reject(err)
  }
)
