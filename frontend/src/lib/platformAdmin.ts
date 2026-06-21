import axios from 'axios'
import { getApiBaseUrl } from './api'

const ADMIN_KEY_STORAGE = 'aura_platform_admin_key'

export function getStoredAdminKey(): string | null {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE)
}

export function setStoredAdminKey(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key)
}

export function clearStoredAdminKey(): void {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE)
}

function adminBase() {
  return getApiBaseUrl().replace(/\/api$/, '')
}

function adminHeaders(adminKey: string) {
  return { 'X-Admin-Key': adminKey }
}

export interface PlatformRegistration {
  userId: string
  ownerName: string
  email: string
  phone: string | null
  registeredAt: string
  registeredAtRome: string
  restaurantId: string
  restaurantName: string
  slug: string
  restaurantEmail: string | null
  isSetupComplete: boolean
  hasActiveSubscription: boolean
  planTier: string
  countryCode: string
}

export interface RegistrationsResponse {
  count: number
  filter: { today?: boolean; date?: string; timezone: string }
  registrations: PlatformRegistration[]
}

export interface PendingSetupOwner {
  name: string
  email: string
}

export interface PendingSetupRestaurant {
  id: string
  name: string
  slug: string
  email: string | null
  isSetupComplete: boolean
  createdAt: string
  settings: { hasActiveSubscription: boolean; planTier: string } | null
  users: PendingSetupOwner[]
}

export interface PendingSetupResponse {
  count: number
  restaurants: PendingSetupRestaurant[]
}

export interface SetupCompleteResponse {
  success: boolean
  message: string
  restaurant: PendingSetupRestaurant
}

export async function fetchRegistrations(
  adminKey: string,
  params: { today?: boolean; date?: string; limit?: number },
): Promise<RegistrationsResponse> {
  const { data } = await axios.get<RegistrationsResponse>(`${adminBase()}/api/admin/registrations`, {
    headers: adminHeaders(adminKey),
    params,
  })
  return data
}

export async function fetchPendingSetup(adminKey: string): Promise<PendingSetupResponse> {
  const { data } = await axios.get<PendingSetupResponse>(`${adminBase()}/api/admin/pending-setup`, {
    headers: adminHeaders(adminKey),
  })
  return data
}

export async function completeSetup(
  adminKey: string,
  payload: { ownerEmail?: string; slug?: string; restaurantId?: string },
): Promise<SetupCompleteResponse> {
  const { data } = await axios.post<SetupCompleteResponse>(
    `${adminBase()}/api/admin/setup-complete`,
    payload,
    { headers: { ...adminHeaders(adminKey), 'Content-Type': 'application/json' } },
  )
  return data
}
