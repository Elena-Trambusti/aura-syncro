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
}

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
  const slot = await validateReservationSlot(input.restaurantId, {
    date: input.date,
    covers: input.covers,
    duration,
    tableId: input.tableId,
  })

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: input.restaurantId },
  })

  const reservation = await prisma.reservation.create({
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
      status: slot.status,
      customerId,
    },
    include: { table: true, customer: true, restaurant: { select: { slug: true, name: true } } },
  })

  if (reservation.tableId) {
    await syncTableReservedForReservation(reservation.tableId, input.restaurantId)
  }

  return {
    reservation,
    depositRequired: requiresDeposit(settings),
    depositAmount: settings?.depositAmount ?? 0,
  }
}

export async function syncTableReservedForReservation(
  tableId: string | null | undefined,
  restaurantId: string,
): Promise<void> {
  if (!tableId) return
  await prisma.table.updateMany({
    where: { id: tableId, restaurantId, status: 'FREE' },
    data: { status: 'RESERVED' },
  })
}

export { ReservationValidationError }
