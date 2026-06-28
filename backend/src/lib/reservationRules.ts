import { prisma } from './prisma'

export class ReservationValidationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
  }
}

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
): Promise<{ status: 'PENDING' | 'CONFIRMED' }> {
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
  })

  const maxCovers = settings?.maxCoversPerSlot ?? 999
  const autoConfirm = settings?.autoConfirmReservations ?? true

  if (input.covers > maxCovers) {
    throw new ReservationValidationError(
      `Massimo ${maxCovers} coperti per slot`,
      'MAX_COVERS_EXCEEDED',
    )
  }

  const requestStart = input.date.getTime()
  const requestEnd = requestStart + input.duration * 60_000

  const windowStart = new Date(requestStart - 24 * 60 * 60_000)
  const windowEnd = new Date(requestEnd + 24 * 60 * 60_000)

  const allReservations = await prisma.reservation.findMany({
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
  }

  return { status: autoConfirm ? 'CONFIRMED' : 'PENDING' }
}

export function requiresDeposit(settings: {
  noShowDepositRequired?: boolean | null
  depositAmount?: number | null
} | null | undefined): boolean {
  return Boolean(settings?.noShowDepositRequired && (settings.depositAmount ?? 0) > 0)
}
