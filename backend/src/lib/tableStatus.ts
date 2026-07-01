import type { TableStatus } from '@prisma/client'

/** Transizioni manuali consentite via PATCH /tables/:id/status (staff). */
const MANUAL_TRANSITIONS: Record<TableStatus, readonly TableStatus[]> = {
  FREE: ['CLEANING'],
  OCCUPIED: ['CLEANING'],
  RESERVED: ['FREE', 'CLEANING'],
  CLEANING: ['FREE'],
}

export function isManualTableTransitionAllowed(from: TableStatus, to: TableStatus): boolean {
  if (from === to) return true
  return MANUAL_TRANSITIONS[from]?.includes(to) ?? false
}

export const TABLE_TRANSITION_ERROR = 'TABLE_STATUS_TRANSITION_DENIED'
