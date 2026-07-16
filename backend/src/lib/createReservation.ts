import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { resolveOrCreateCustomer } from './customerResolver'
import {
  validateReservationSlot,
  ReservationValidationError,
  requiresDeposit,
} from './reservationRules'

export interface CreateReservationInput {
  restaurantId: string
  guestName: string
  guestPhone: string
  guestEmail?: string
  covers: number
  date: Date
  duration?: number
  tableId?: string
  notes?: string
  internalNotes?: string
  /** Staff waitlist/seat: conferma immediata anche se deposit richiesto (ospite già presente). */
  forceConfirmed?: boolean
}

type DbClient = Prisma.TransactionClient | typeof prisma

export async function createReservation(input: CreateReservationInput) {
  if (input.tableId) {
    const table = await prisma.table.findFirst({
      where: { id: input.tableId, restaurantId: input.restaurantId },
    })
    if (!table) {
      throw new ReservationValidationError('Tavolo non trovato', 'TABLE_NOT_FOUND')
    }
  }

  const customerId = await resolveOrCreateCustomer(input.restaurantId, {
    name: input.guestName,
    email: input.guestEmail,
    phone: input.guestPhone,
  })

  const duration = input.duration ?? 90

  return prisma.$transaction(async (tx) => {
    const slot = await validateReservationSlot(input.restaurantId, {
      date: input.date,
      covers: input.covers,
      duration,
      tableId: input.tableId,
    }, tx)

    const settings = await tx.restaurantSettings.findUnique({
      where: { restaurantId: input.restaurantId },
    })

    const status = input.forceConfirmed ? 'CONFIRMED' : slot.status

    const reservation = await tx.reservation.create({
      data: {
        restaurantId: input.restaurantId,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        covers: input.covers,
        date: input.date,
        duration,
        tableId: input.tableId,
        notes: input.notes,
        internalNotes: input.internalNotes,
        status,
        customerId,
      },
      include: { table: true, customer: true, restaurant: { select: { slug: true, name: true } } },
    })

    if (reservation.tableId && status === 'CONFIRMED') {
      await syncTableReservedForReservation(reservation.tableId, input.restaurantId, tx)
    } else if (reservation.tableId && status === 'PENDING' && !requiresDeposit(settings)) {
      await syncTableReservedForReservation(reservation.tableId, input.restaurantId, tx)
    }

    return {
      reservation,
      depositRequired: requiresDeposit(settings),
      depositAmount: settings?.depositAmount ?? 0,
    }
  }, { isolationLevel: 'Serializable' })
}

export async function syncTableReservedForReservation(
  tableId: string | null | undefined,
  restaurantId: string,
  db: DbClient = prisma,
): Promise<void> {
  if (!tableId) return
  await db.table.updateMany({
    where: { id: tableId, restaurantId, status: 'FREE' },
    data: { status: 'RESERVED' },
  })
}

export { ReservationValidationError }
