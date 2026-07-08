import type { QueryClient } from '@tanstack/react-query'
import { tq } from './queryKeys'

export interface CachedReservation {
  id: string
  status: string
  guestName?: string
  guestPhone?: string
  covers?: number
  date?: string
  notes?: string
  notifiedAt?: string
  [key: string]: unknown
}

export interface CachedWaitlistEntry {
  id: string
  status: string
  guestName?: string
  notifiedAt?: string
  [key: string]: unknown
}

function reservationsKey(tenantKey: string | undefined, date: string) {
  if (!tenantKey) return null
  return tq(tenantKey, 'reservations', date)
}

function waitlistKey(tenantKey: string | undefined, date: string) {
  if (!tenantKey) return null
  return tq(tenantKey, 'waitlist', date)
}

export function snapshotReservations(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
): CachedReservation[] | undefined {
  const key = reservationsKey(tenantKey, date)
  if (!key) return undefined
  return queryClient.getQueryData<CachedReservation[]>(key)
}

export function patchReservationStatus(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
  id: string,
  status: string,
): CachedReservation[] | undefined {
  const key = reservationsKey(tenantKey, date)
  const previous = key ? queryClient.getQueryData<CachedReservation[]>(key) : undefined
  if (!key || !previous) return previous

  queryClient.setQueryData<CachedReservation[]>(
    key,
    previous.map(r => (r.id === id ? { ...r, status } : r)),
  )
  return previous
}

export function appendReservation(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
  reservation: CachedReservation,
): CachedReservation[] | undefined {
  const key = reservationsKey(tenantKey, date)
  const previous = key ? queryClient.getQueryData<CachedReservation[]>(key) : undefined
  if (!key) return previous

  queryClient.setQueryData<CachedReservation[]>(key, [...(previous ?? []), reservation])
  return previous
}

export function restoreReservations(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
  snapshot: CachedReservation[] | undefined,
) {
  const key = reservationsKey(tenantKey, date)
  if (key && snapshot) queryClient.setQueryData(key, snapshot)
}

export function snapshotWaitlist(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
): CachedWaitlistEntry[] | undefined {
  const key = waitlistKey(tenantKey, date)
  if (!key) return undefined
  return queryClient.getQueryData<CachedWaitlistEntry[]>(key)
}

export function patchWaitlistEntry(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
  id: string,
  patch: Partial<CachedWaitlistEntry>,
): CachedWaitlistEntry[] | undefined {
  const key = waitlistKey(tenantKey, date)
  const previous = key ? queryClient.getQueryData<CachedWaitlistEntry[]>(key) : undefined
  if (!key || !previous) return previous

  queryClient.setQueryData<CachedWaitlistEntry[]>(
    key,
    previous.map(e => (e.id === id ? { ...e, ...patch } : e)),
  )
  return previous
}

export function removeWaitlistEntry(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
  id: string,
): CachedWaitlistEntry[] | undefined {
  const key = waitlistKey(tenantKey, date)
  const previous = key ? queryClient.getQueryData<CachedWaitlistEntry[]>(key) : undefined
  if (!key || !previous) return previous

  queryClient.setQueryData<CachedWaitlistEntry[]>(
    key,
    previous.filter(e => e.id !== id),
  )
  return previous
}

export function appendWaitlistEntry(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
  entry: CachedWaitlistEntry,
): CachedWaitlistEntry[] | undefined {
  const key = waitlistKey(tenantKey, date)
  const previous = key ? queryClient.getQueryData<CachedWaitlistEntry[]>(key) : undefined
  if (!key) return previous

  queryClient.setQueryData<CachedWaitlistEntry[]>(key, [...(previous ?? []), entry])
  return previous
}

export function restoreWaitlist(
  queryClient: QueryClient,
  tenantKey: string | undefined,
  date: string,
  snapshot: CachedWaitlistEntry[] | undefined,
) {
  const key = waitlistKey(tenantKey, date)
  if (key && snapshot) queryClient.setQueryData(key, snapshot)
}
