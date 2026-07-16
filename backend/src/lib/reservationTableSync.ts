import { prisma } from './prisma'
import { ReservationValidationError, validateReservationSlot, requiresDeposit } from './reservationRules'
import { countActiveTableOrders } from './orderSession'
import type { Prisma } from '@prisma/client'

const ACTIVE_RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'SEATED'] as const

type DbClient = Prisma.TransactionClient | typeof prisma

export async function releaseTableFromReservation(
  restaurantId: string,
  tableId: string | null | undefined,
  excludeReservationId?: string,
  db: DbClient = prisma,
): Promise<void> {
  if (!tableId) return

  const table = await db.table.findFirst({
    where: { id: tableId, restaurantId },
  })
  if (!table) return

  const settings = await db.restaurantSettings.findUnique({
    where: { restaurantId },
    select: { noShowDepositRequired: true, depositAmount: true },
  })
  const depositRequired = requiresDeposit(settings)

  const candidates = await db.reservation.findMany({
    where: {
      restaurantId,
      tableId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { id: true, status: true, depositPaid: true },
  })
  const otherActive = candidates.filter(r => {
    if (!depositRequired) return true
    if (r.depositPaid) return true
    if (r.status === 'PENDING') return false
    return true
  }).length

  if (otherActive > 0) return
  const activeOrders = await countActiveTableOrders(tableId, restaurantId, db)
  if (activeOrders > 0) return

  if (table.status === 'RESERVED' || table.status === 'FREE') {
    await db.table.update({
      where: { id: tableId },
      data: { status: 'FREE' },
    })
  }
}

async function isTableSuitableForReservation(
  table: { id: string; seats: number; status: string },
  reservationCovers: number,
  overlappingTableIds: Set<string>,
  restaurantId: string,
): Promise<boolean> {
  if (table.seats < reservationCovers) return false
  if (overlappingTableIds.has(table.id)) return false
  if (!['FREE', 'RESERVED'].includes(table.status)) return false
  const activeOrders = await countActiveTableOrders(table.id, restaurantId)
  return activeOrders === 0
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
    select: { id: true, tableId: true, date: true, duration: true, status: true, depositPaid: true },
  })

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
    select: { noShowDepositRequired: true, depositAmount: true },
  })
  const depositRequired = requiresDeposit(settings)

  const requestStart = reservation.date.getTime()
  const requestEnd = requestStart + reservation.duration * 60_000

  const overlappingTableIds = new Set<string>()
  for (const r of allReservations) {
    if (!r.tableId) continue
    if (depositRequired && !r.depositPaid && r.status === 'PENDING') continue
    const rStart = r.date.getTime()
    const rEnd = rStart + (r.duration ?? 90) * 60_000
    if (rStart < requestEnd && rEnd > requestStart) {
      overlappingTableIds.add(r.tableId)
    }
  }

  const suitability = await Promise.all(
    tables.map(async t => ({
      table: t,
      suitable: await isTableSuitableForReservation(t, reservation.covers, overlappingTableIds, restaurantId),
    })),
  )

  return suitability
    .filter(({ table, suitable }) => suitable || table.id === reservation.tableId)
    .map(({ table, suitable }) => ({
      id: table.id,
      number: table.number,
      seats: table.seats,
      area: table.area,
      status: table.status,
      suitable,
    }))
}

export async function confirmReservationWithTable(
  restaurantId: string,
  reservationId: string,
  tableId: string,
) {
  return prisma.$transaction(async tx => {
    const reservation = await tx.reservation.findFirst({
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

    const table = await tx.table.findFirst({
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
    if (table.status === 'CLEANING') {
      throw new ReservationValidationError('Tavolo in pulizia', 'TABLE_UNAVAILABLE')
    }
    if (!['FREE', 'RESERVED', 'OCCUPIED'].includes(table.status) && table.id !== reservation.tableId) {
      throw new ReservationValidationError('Tavolo non disponibile', 'TABLE_UNAVAILABLE')
    }

    const activeOrders = await countActiveTableOrders(tableId, restaurantId, tx)
    if (activeOrders > 0 && table.id !== reservation.tableId) {
      throw new ReservationValidationError('Tavolo con ordine attivo', 'TABLE_HAS_ORDER')
    }

    await validateReservationSlot(restaurantId, {
      date: reservation.date,
      covers: reservation.covers,
      duration: reservation.duration,
      tableId,
      excludeReservationId: reservationId,
    })

    const claimed = await tx.table.updateMany({
      where: {
        id: tableId,
        restaurantId,
        status: { in: ['FREE', 'RESERVED'] },
      },
      data: { status: 'OCCUPIED' },
    })
    if (claimed.count === 0 && table.status !== 'OCCUPIED') {
      throw new ReservationValidationError('Tavolo non disponibile', 'TABLE_UNAVAILABLE')
    }

    const previousTableId = reservation.tableId

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'SEATED', tableId },
      include: { table: true, customer: true },
    })

    if (previousTableId && previousTableId !== tableId) {
      await releaseTableFromReservation(restaurantId, previousTableId, reservationId, tx)
    }

    return updated
  }, { isolationLevel: 'Serializable' })
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
