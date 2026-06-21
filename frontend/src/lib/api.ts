import axios from 'axios'

const RESTAURANT_ID_KEY = 'restaurantId'

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/api`
  }
  return '/api'
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
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
      const path = window.location.pathname
      const isGuestRoute = path.startsWith('/menu/') || path.startsWith('/payment/')
      if (!isGuestRoute) {
        localStorage.removeItem('token')
        localStorage.removeItem(RESTAURANT_ID_KEY)
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)
