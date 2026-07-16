import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { countActiveTableOrders } from './orderSession'
import { resolveMaxCoversPerSlot } from './reservationCapacity'

export class ReservationValidationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
  }
}

type DbClient = Prisma.TransactionClient | typeof prisma

/** Applica regole prenotazione da RestaurantSettings. */
export async function validateReservationSlot(
  restaurantId: string,
  input: {
    date: Date
    covers: number
    duration: number
    tableId?: string | null
    excludeReservationId?: string
  },
  db: DbClient = prisma,
): Promise<{ status: 'PENDING' | 'CONFIRMED' }> {
  const settings = await db.restaurantSettings.findUnique({
    where: { restaurantId },
  })

  const maxCovers = await resolveMaxCoversPerSlot(restaurantId, db)
  const autoConfirm = settings?.autoConfirmReservations ?? true

  if (input.covers > maxCovers) {
    throw new ReservationValidationError(
      `Massimo ${maxCovers} coperti per slot`,
      'MAX_COVERS_EXCEEDED',
    )
  }

  const requestStart = input.date.getTime()
  const requestEnd = requestStart + input.duration * 60_000

  const windowMs = input.duration * 60_000
  const windowStart = new Date(requestStart - windowMs)
  const windowEnd = new Date(requestEnd + windowMs)

  const allReservations = await db.reservation.findMany({
    where: {
      restaurantId,
      status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
      date: { gte: windowStart, lte: windowEnd },
      ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
    },
    select: { id: true, covers: true, tableId: true, date: true, duration: true },
  })

  const overlapping = allReservations.filter(r => {
    const rStart = r.date.getTime()
    const rEnd = rStart + (r.duration ?? 90) * 60_000
    return rStart < requestEnd && rEnd > requestStart
  })

  const coversInSlot = overlapping.reduce((sum, r) => sum + r.covers, 0)
  if (coversInSlot + input.covers > maxCovers) {
    throw new ReservationValidationError(
      `Slot pieno: ${coversInSlot}/${maxCovers} coperti già prenotati`,
      'SLOT_FULL',
    )
  }

  if (input.tableId) {
    const tableTaken = overlapping.some(r => r.tableId === input.tableId)
    if (tableTaken) {
      throw new ReservationValidationError(
        'Tavolo già prenotato in questo orario',
        'TABLE_UNAVAILABLE',
      )
    }

    const table = await db.table.findFirst({
      where: { id: input.tableId, restaurantId },
      select: { status: true },
    })
    if (!table) {
      throw new ReservationValidationError('Tavolo non trovato', 'TABLE_NOT_FOUND')
    }
    if (!['FREE', 'RESERVED'].includes(table.status)) {
      throw new ReservationValidationError(
        'Tavolo non disponibile per prenotazione',
        'TABLE_OCCUPIED',
      )
    }
    const activeOrders = await countActiveTableOrders(input.tableId, restaurantId, db)
    if (activeOrders > 0) {
      throw new ReservationValidationError(
        'Tavolo con ordine attivo — non prenotabile',
        'TABLE_OCCUPIED',
      )
    }
  }

  return { status: (autoConfirm && !requiresDeposit(settings)) ? 'CONFIRMED' : 'PENDING' }
}

import type { MoneyInput } from './money'
import { moneyNumber } from './money'

export function requiresDeposit(settings: {
  noShowDepositRequired?: boolean | null
  depositAmount?: MoneyInput | null
} | null | undefined): boolean {
  return Boolean(settings?.noShowDepositRequired && moneyNumber(settings.depositAmount) > 0)
}
