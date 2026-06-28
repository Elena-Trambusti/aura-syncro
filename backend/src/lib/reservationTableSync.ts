import { prisma } from './prisma'
import { ReservationValidationError, validateReservationSlot } from './reservationRules'
import { countActiveTableOrders } from './orderSession'

const ACTIVE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'SEATED'] as const

export async function releaseTableFromReservation(
  restaurantId: string,
  tableId: string | null | undefined,
  excludeReservationId?: string,
): Promise<void> {
  if (!tableId) return

  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
  })
  if (!table) return

  const otherActive = await prisma.reservation.count({
    where: {
      restaurantId,
      tableId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
  })

  if (otherActive > 0) return
  const activeOrders = await countActiveTableOrders(tableId, restaurantId)
  if (activeOrders > 0) return

  if (table.status === 'RESERVED' || table.status === 'FREE') {
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'FREE' },
    })
  }
}

export async function getAvailableTablesForReservation(
  restaurantId: string,
  reservationId: string,
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  })
  if (!reservation) {
    throw new ReservationValidationError('Prenotazione non trovata', 'NOT_FOUND')
  }

  const tables = await prisma.table.findMany({
    where: { restaurantId },
    orderBy: { number: 'asc' },
  })

  const allReservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
      status: { notIn: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
      id: { not: reservationId },
    },
    select: { id: true, tableId: true, date: true, duration: true },
  })

  const requestStart = reservation.date.getTime()
  const requestEnd = requestStart + reservation.duration * 60_000

  const overlappingTableIds = new Set<string>()
  for (const r of allReservations) {
    if (!r.tableId) continue
    const rStart = r.date.getTime()
    const rEnd = rStart + (r.duration ?? 90) * 60_000
    if (rStart < requestEnd && rEnd > requestStart) {
      overlappingTableIds.add(r.tableId)
    }
  }

  return tables
    .filter(t => t.seats >= reservation.covers)
    .filter(t => !overlappingTableIds.has(t.id) || t.id === reservation.tableId)
    .map(t => ({
      id: t.id,
      number: t.number,
      seats: t.seats,
      area: t.area,
      status: t.status,
      suitable:
        t.seats >= reservation.covers
        && !overlappingTableIds.has(t.id),
    }))
}

export async function confirmReservationWithTable(
  restaurantId: string,
  reservationId: string,
  tableId: string,
) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
  })
  if (!reservation) {
    throw new ReservationValidationError('Prenotazione non trovata', 'NOT_FOUND')
  }
  if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
    throw new ReservationValidationError(
      'Solo prenotazioni in attesa o confermate possono essere accomodate',
      'INVALID_STATUS',
    )
  }

  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
  })
  if (!table) {
    throw new ReservationValidationError('Tavolo non trovato', 'TABLE_NOT_FOUND')
  }
  if (table.seats < reservation.covers) {
    throw new ReservationValidationError(
      `Il tavolo ha solo ${table.seats} posti`,
      'TABLE_TOO_SMALL',
    )
  }
  if (table.status === 'OCCUPIED' && table.id !== reservation.tableId) {
    throw new ReservationValidationError('Tavolo non disponibile', 'TABLE_UNAVAILABLE')
  }
  if (table.status === 'CLEANING') {
    throw new ReservationValidationError('Tavolo in pulizia', 'TABLE_UNAVAILABLE')
  }
  const activeOrders = await countActiveTableOrders(tableId, restaurantId)
  if (activeOrders > 0) {
    throw new ReservationValidationError('Tavolo con ordine attivo', 'TABLE_HAS_ORDER')
  }

  await validateReservationSlot(restaurantId, {
    date: reservation.date,
    covers: reservation.covers,
    duration: reservation.duration,
    tableId,
    excludeReservationId: reservationId,
  })

  const previousTableId = reservation.tableId

  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: 'SEATED', tableId },
    include: { table: true, customer: true },
  })

  await prisma.table.update({
    where: { id: tableId },
    data: { status: 'OCCUPIED' },
  })

  if (previousTableId && previousTableId !== tableId) {
    await releaseTableFromReservation(restaurantId, previousTableId, reservationId)
  }

  return updated
}

export async function syncTableOnReservationStatus(
  restaurantId: string,
  reservationId: string,
  newStatus: string,
): Promise<void> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId },
    select: { id: true, tableId: true, status: true },
  })
  if (!reservation?.tableId) return

  if (newStatus === 'SEATED') {
    await prisma.table.update({
      where: { id: reservation.tableId },
      data: { status: 'OCCUPIED' },
    })
    return
  }

  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(newStatus)) {
    await releaseTableFromReservation(restaurantId, reservation.tableId, reservationId)
  }
}
