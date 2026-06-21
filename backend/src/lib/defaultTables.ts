import { prisma } from './prisma'

const DEFAULT_TABLES = [
  { number: 1, seats: 2, posX: 80, posY: 80, area: 'Sala' },
  { number: 2, seats: 4, posX: 200, posY: 80, area: 'Sala' },
  { number: 3, seats: 4, posX: 320, posY: 80, area: 'Sala' },
  { number: 4, seats: 6, posX: 440, posY: 80, area: 'Sala' },
  { number: 5, seats: 2, posX: 80, posY: 220, area: 'Terrazza' },
  { number: 6, seats: 4, posX: 200, posY: 220, area: 'Terrazza' },
  { number: 7, seats: 4, posX: 320, posY: 220, area: 'Terrazza' },
  { number: 8, seats: 8, posX: 440, posY: 220, area: 'Terrazza', shape: 'RECTANGLE' as const },
]

/** Crea tavoli iniziali se il ristorante non ne ha ancora. */
export async function ensureDefaultTables(restaurantId: string): Promise<number> {
  const existing = await prisma.table.count({ where: { restaurantId } })
  if (existing > 0) return 0

  await prisma.table.createMany({
    data: DEFAULT_TABLES.map(t => ({ ...t, restaurantId })),
  })
  return DEFAULT_TABLES.length
}
