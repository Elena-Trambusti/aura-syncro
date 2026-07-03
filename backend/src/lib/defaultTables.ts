import { prisma } from './prisma'
import { OBSIDIAN_ROOM_TEMPLATE, DEFAULT_TABLE_POSITIONS_PERCENT } from './floorPlanTemplates'

const DEFAULT_TABLES = DEFAULT_TABLE_POSITIONS_PERCENT

/** Crea tavoli iniziali se il ristorante non ne ha ancora. */
export async function ensureDefaultTables(restaurantId: string): Promise<number> {
  const existing = await prisma.table.count({ where: { restaurantId } })
  if (existing > 0) return 0

  await prisma.table.createMany({
    data: DEFAULT_TABLES.map(t => ({ ...t, restaurantId })),
  })
  return DEFAULT_TABLES.length
}

/** Popola layout pavimento 2.5D se assente. */
export async function ensureDefaultFloorPlan(restaurantId: string): Promise<boolean> {
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId },
    select: { floorPlanLayout: true },
  })
  if (settings?.floorPlanLayout) return false

  await prisma.restaurantSettings.upsert({
    where: { restaurantId },
    create: { restaurantId, floorPlanLayout: OBSIDIAN_ROOM_TEMPLATE },
    update: { floorPlanLayout: OBSIDIAN_ROOM_TEMPLATE },
  })
  return true
}
