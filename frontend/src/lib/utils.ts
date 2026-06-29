import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import i18n, { getIntlLocale } from '../i18n'

export { getIntlLocale }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(getIntlLocale(), { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat(getIntlLocale(), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

/** YYYY-MM-DD in local timezone (never use toISOString() for date inputs). */
export function toLocalDateInput(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** YYYY-MM-DD resolved in a specific IANA timezone. */
export function toDateInputInTimezone(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date)
}

/** Calendar date in tenant TZ shifted by N days (for reservation day pills). */
export function dateInputOffsetInTimezone(timeZone: string, offsetDays = 0): string {
  const [y, m, d] = toDateInputInTimezone(timeZone).split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1, d + offsetDays, 12))
  return toDateInputInTimezone(timeZone, anchor)
}

/** Year and month (1–12) in tenant timezone — for report period defaults. */
export function monthYearInTimezone(timeZone: string, date = new Date()): { year: number; month: number } {
  const [year, month] = toDateInputInTimezone(timeZone, date).split('-').map(Number)
  return { year, month }
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function getOrderStatusLabel(status: string): string {
  return i18n.t(`status.order.${status}`, { defaultValue: status })
}

export function getTableStatusLabel(status: string): string {
  return i18n.t(`status.table.${status}`, { defaultValue: status })
}

export function getReservationStatusLabel(status: string): string {
  return i18n.t(`status.reservation.${status}`, { defaultValue: status })
}

export function getRoleLabel(role: string): string {
  return i18n.t(`status.role.${role}`, { defaultValue: role })
}

/** @deprecated Use getOrderStatusLabel() */
export const ORDER_STATUS_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, prop: string) => getOrderStatusLabel(prop),
})

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  SERVED: 'bg-purple-100 text-purple-800',
  PAID: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

/** @deprecated Use getTableStatusLabel() */
export const TABLE_STATUS_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, prop: string) => getTableStatusLabel(prop),
})

export const TABLE_STATUS_COLORS: Record<string, string> = {
  FREE: 'bg-emerald-500/100',
  OCCUPIED: 'bg-red-500/100',
  RESERVED: 'bg-aura-gold/100',
  CLEANING: 'bg-blue-500/100',
}

/** @deprecated Use getReservationStatusLabel() */
export const RESERVATION_STATUS_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, prop: string) => getReservationStatusLabel(prop),
})

/** @deprecated Use getRoleLabel() */
export const ROLE_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_, prop: string) => getRoleLabel(prop),
})
