import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'In attesa',
  CONFIRMED: 'Confermato',
  PREPARING: 'In preparazione',
  READY: 'Pronto',
  SERVED: 'Servito',
  PAID: 'Pagato',
  CANCELLED: 'Annullato',
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  SERVED: 'bg-purple-100 text-purple-800',
  PAID: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export const TABLE_STATUS_LABELS: Record<string, string> = {
  FREE: 'Libero',
  OCCUPIED: 'Occupato',
  RESERVED: 'Prenotato',
  CLEANING: 'Pulizia',
}

export const TABLE_STATUS_COLORS: Record<string, string> = {
  FREE: 'bg-emerald-500',
  OCCUPIED: 'bg-red-500',
  RESERVED: 'bg-amber-500',
  CLEANING: 'bg-blue-500',
}

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'In attesa',
  CONFIRMED: 'Confermata',
  SEATED: 'Al tavolo',
  COMPLETED: 'Completata',
  CANCELLED: 'Annullata',
  NO_SHOW: 'Non presentato',
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietario',
  MANAGER: 'Manager',
  WAITER: 'Cameriere',
  KITCHEN: 'Cucina',
  CASHIER: 'Cassiere',
}
