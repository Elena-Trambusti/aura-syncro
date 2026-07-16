import { prisma } from './prisma'
import { countActiveTableOrders } from './orderSession'

/** Ripara tavoli OCCUPIED senza ordini attivi (stato zombi). */
export async function reconcileZombieOccupiedTables(): Promise<number> {
  const occupied = await prisma.table.findMany({
    where: { status: 'OCCUPIED' },
    select: { id: true, restaurantId: true },
    take: 100,
    orderBy: { updatedAt: 'asc' },
  })

  let fixed = 0
  for (const table of occupied) {
    const active = await countActiveTableOrders(table.id, table.restaurantId)
    if (active > 0) continue

    const updated = await prisma.table.updateMany({
      where: { id: table.id, restaurantId: table.restaurantId, status: 'OCCUPIED' },
      data: { status: 'CLEANING' },
    })
    if (updated.count > 0) fixed += 1
  }

  return fixed
}
