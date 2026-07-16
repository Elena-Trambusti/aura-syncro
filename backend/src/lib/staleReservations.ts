import { prisma } from './prisma'
import { syncTableReservedForReservation } from './createReservation'

const DEPOSIT_PENDING_TTL_MS = Number(process.env.DEPOSIT_PENDING_TTL_MS || 24 * 60 * 60 * 1000)

/**
 * Annulla solo prenotazioni PENDING con caparra obbligatoria mai completata.
 * Non tocca CONFIRMED dello staff (conferma manuale = intenzionale).
 */
export async function cancelStaleDepositReservations(): Promise<number> {
  const cutoff = new Date(Date.now() - DEPOSIT_PENDING_TTL_MS)

  const stale = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      depositPaid: false,
      createdAt: { lt: cutoff },
      restaurant: {
        settings: {
          noShowDepositRequired: true,
          depositAmount: { gt: 0 },
        },
      },
    },
    select: { id: true, restaurantId: true, tableId: true },
    take: 50,
    orderBy: { createdAt: 'asc' },
  })

  let cancelled = 0
  for (const row of stale) {
    const updated = await prisma.reservation.updateMany({
      where: {
        id: row.id,
        restaurantId: row.restaurantId,
        depositPaid: false,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    })
    if (updated.count === 0) continue

    if (row.tableId) {
      await syncTableReservedForReservation(row.tableId, row.restaurantId)
    }
    cancelled += 1
  }

  return cancelled
}
