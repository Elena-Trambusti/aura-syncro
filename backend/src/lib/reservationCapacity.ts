import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

type DbClient = Prisma.TransactionClient | typeof prisma

/** Capacità massima slot: configurazione tenant o somma posti sala. */
export async function resolveMaxCoversPerSlot(
  restaurantId: string,
  db: DbClient = prisma,
): Promise<number> {
  const settings = await db.restaurantSettings.findUnique({
    where: { restaurantId },
    select: { maxCoversPerSlot: true },
  })
  const configured = settings?.maxCoversPerSlot ?? 20

  const seatAgg = await db.table.aggregate({
    where: { restaurantId },
    _sum: { seats: true },
  })
  const venueSeats = seatAgg._sum.seats ?? 0

  if (venueSeats > 0) {
    return Math.max(configured, venueSeats)
  }
  return configured
}
