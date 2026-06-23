import { prisma } from './prisma'

export interface StockLink {
  quantity: number
  inventoryItem: { quantity: number }
}

export interface MenuStockFields {
  soldOut: boolean
  maxPortions: number | null
  orderable: boolean
}

/** Porzioni massime preparabili dalla ricetta (null = nessuna ricetta / nessun vincolo stock). */
export function maxPortionsFromLinks(links: StockLink[]): number | null {
  if (links.length === 0) return null
  let minPortions = Infinity
  for (const link of links) {
    if (link.quantity <= 0) continue
    const portions = Math.floor(link.inventoryItem.quantity / link.quantity)
    minPortions = Math.min(minPortions, portions)
  }
  return minPortions === Infinity ? 0 : Math.max(0, minPortions)
}

export function isStockDepleted(links: StockLink[]): boolean {
  const max = maxPortionsFromLinks(links)
  if (max === null) return false
  return max < 1
}

export function canFulfillQuantity(links: StockLink[], quantity: number): boolean {
  const max = maxPortionsFromLinks(links)
  if (max === null) return true
  return max >= quantity
}

export function computeMenuStockFields(
  item: { available: boolean },
  links: StockLink[],
): MenuStockFields {
  const hasRecipe = links.length > 0
  const maxPortions = hasRecipe ? maxPortionsFromLinks(links) : null
  const stockDepleted = hasRecipe && (maxPortions ?? 0) < 1
  const soldOut = item.available && stockDepleted
  return {
    soldOut,
    maxPortions,
    orderable: item.available && !stockDepleted,
  }
}

export async function loadRecipeLinksMap(
  restaurantId: string,
  menuItemIds?: string[],
): Promise<Map<string, StockLink[]>> {
  const links = await prisma.inventoryItemLink.findMany({
    where: {
      menuItem: {
        restaurantId,
        ...(menuItemIds?.length ? { id: { in: menuItemIds } } : {}),
      },
    },
    include: { inventoryItem: { select: { quantity: true } } },
  })

  const map = new Map<string, StockLink[]>()
  for (const link of links) {
    const list = map.get(link.menuItemId) ?? []
    list.push({
      quantity: link.quantity,
      inventoryItem: { quantity: link.inventoryItem.quantity },
    })
    map.set(link.menuItemId, list)
  }
  return map
}

export async function enrichCategoriesWithStock<T extends { items: Array<{ id: string; available: boolean }> }>(
  categories: T[],
  restaurantId: string,
): Promise<Array<T & { items: Array<T['items'][number] & MenuStockFields> }>> {
  const itemIds = categories.flatMap(c => c.items.map(i => i.id))
  const linksMap = await loadRecipeLinksMap(restaurantId, itemIds)

  return categories.map(cat => ({
    ...cat,
    items: cat.items.map(item => ({
      ...item,
      ...computeMenuStockFields(item, linksMap.get(item.id) ?? []),
    })),
  }))
}

export function assertMenuItemOrderable(
  menuItem: { available: boolean; archived?: boolean; inventoryLinks: StockLink[] },
  quantity: number,
): void {
  if (menuItem.archived) {
    throw Object.assign(new Error('archived'), { code: 'MENU_ITEM_ARCHIVED' })
  }
  if (!menuItem.available) {
    throw Object.assign(new Error('unavailable'), { code: 'MENU_ITEM_UNAVAILABLE' })
  }
  if (!canFulfillQuantity(menuItem.inventoryLinks, quantity)) {
    throw Object.assign(new Error('sold out'), { code: 'MENU_ITEM_SOLD_OUT' })
  }
}
