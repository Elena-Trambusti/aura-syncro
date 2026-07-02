import axios from 'axios'
import { resolveBackendUrl } from './backendUrl'

/** Chiave admin solo in memoria (non persistita — si perde al refresh). */
let inMemoryAdminKey: string | null = null

export function getStoredAdminKey(): string | null {
  return inMemoryAdminKey
}

export function setStoredAdminKey(key: string): void {
  inMemoryAdminKey = key
}

export function clearStoredAdminKey(): void {
  inMemoryAdminKey = null
}

function adminBase() {
  return resolveBackendUrl() ?? ''
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
  onboardingIntake?: any
  onboardingSubmittedAt?: string
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
  settings: { 
    hasActiveSubscription: boolean; 
    planTier: string;
    onboardingIntake?: any;
    onboardingSubmittedAt?: string;
  } | null
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

export async function markSetupComplete(
  adminKey: string,
  body: { restaurantId?: string; slug?: string; ownerEmail?: string },
): Promise<SetupCompleteResponse> {
  const { data } = await axios.post<SetupCompleteResponse>(`${adminBase()}/api/admin/setup-complete`, body, {
    headers: { ...adminHeaders(adminKey), 'Content-Type': 'application/json' },
  })
  return data
}

/** @deprecated alias */
export const completeSetup = markSetupComplete

export async function deleteRestaurant(
  adminKey: string,
  restaurantId: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await axios.post(
    `${adminBase()}/api/admin/restaurant-delete`,
    { restaurantId, confirm: true },
    { headers: { ...adminHeaders(adminKey), 'Content-Type': 'application/json' } },
  )
  return data
}

export async function downgradePlan(adminKey: string, restaurantId: string): Promise<void> {
  await axios.post(`${adminBase()}/api/admin/plan-downgrade`, { restaurantId }, {
    headers: adminHeaders(adminKey),
  })
}
