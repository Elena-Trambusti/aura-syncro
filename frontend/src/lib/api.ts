import axios from 'axios'

const RESTAURANT_ID_KEY = 'restaurantId'

export const api = axios.create({
  baseURL: '/api',
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
      localStorage.removeItem('token')
      localStorage.removeItem(RESTAURANT_ID_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
