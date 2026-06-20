import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setTenantHeader } from '../lib/api'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { applyTenantCssVars } from '../lib/tenantTheme'

interface User {
  id: string
  name: string
  email: string
  role: string
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  colorTheme: string
  logoUrl?: string | null
}

interface AuthContextType {
  user: User | null
  restaurant: Restaurant | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
}

interface RegisterData {
  restaurantName: string
  name: string
  email: string
  password: string
  phone?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem('token'))

  const setAuth = useCallback((data: { token: string; user: User; restaurant: Restaurant }) => {
    localStorage.setItem('token', data.token)
    setTenantHeader(data.restaurant.id)
    setToken(data.token)
    setUser(data.user)
    setRestaurant(data.restaurant)
    applyTenantCssVars(data.restaurant.colorTheme)
    connectSocket(data.token)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setTenantHeader(null)
    setToken(null)
    setUser(null)
    setRestaurant(null)
    applyTenantCssVars('#c9a227')
    disconnectSocket()
  }, [])

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setIsLoading(false)
      return
    }
    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user)
        setRestaurant(res.data.restaurant)
        setTenantHeader(res.data.restaurant.id)
        applyTenantCssVars(res.data.restaurant.colorTheme)
        connectSocket(storedToken)
      })
      .catch(() => logout())
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    applyTenantCssVars(restaurant?.colorTheme)
  }, [restaurant?.colorTheme])

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    setAuth(res.data)
  }

  const register = async (data: RegisterData) => {
    const res = await api.post('/auth/register', data)
    setAuth(res.data)
  }

  return (
    <AuthContext.Provider value={{ user, restaurant, token, isLoading, login, register, logout }}>
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
