import { prisma } from './prisma'
import { moneyNumber } from './money'

export type CsvImportRow = {
  name: string
  price: number
  category: string
  description?: string
}

export type CsvImportResult = {
  created: number
  skipped: number
  categoriesCreated: number
  errors: string[]
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

/** Parser CSV minimale: name,price,category[,description] */
export function parseMenuCsv(csvText: string): { rows: CsvImportRow[]; errors: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))

  const errors: string[] = []
  const rows: CsvImportRow[] = []

  let start = 0
  const header = parseCsvLine(lines[0] ?? '').map(h => h.toLowerCase())
  if (header.includes('name') && header.includes('price')) {
    start = 1
  }

  for (let i = start; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!)
    if (cells.length < 3) {
      errors.push(`Riga ${i + 1}: colonne insufficienti`)
      continue
    }
    const [name, priceRaw, category, description] = cells
    const price = Number.parseFloat(priceRaw.replace(',', '.'))
    if (!name?.trim()) {
      errors.push(`Riga ${i + 1}: nome mancante`)
      continue
    }
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`Riga ${i + 1}: prezzo non valido`)
      continue
    }
    if (!category?.trim()) {
      errors.push(`Riga ${i + 1}: categoria mancante`)
      continue
    }
    rows.push({
      name: name.trim(),
      price,
      category: category.trim(),
      description: description?.trim() || undefined,
    })
  }

  return { rows, errors }
}

export async function importMenuFromCsv(restaurantId: string, csvText: string): Promise<CsvImportResult> {
  const { rows, errors } = parseMenuCsv(csvText)
  if (rows.length === 0) {
    return { created: 0, skipped: 0, categoriesCreated: 0, errors: errors.length ? errors : ['Nessuna riga valida'] }
  }

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId },
    select: { id: true, name: true, sortOrder: true },
  })
  const categoryByName = new Map(categories.map(c => [c.name.toLowerCase(), c]))
  let categoriesCreated = 0
  let created = 0
  let skipped = 0

  const maxSort = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0)

  for (const row of rows) {
    const key = row.category.toLowerCase()
    let category = categoryByName.get(key)
    if (!category) {
      const sortOrder = maxSort + categoriesCreated + 1
      const createdCat = await prisma.menuCategory.create({
        data: { restaurantId, name: row.category, sortOrder, active: true },
      })
      category = { id: createdCat.id, name: createdCat.name, sortOrder: createdCat.sortOrder }
      categoryByName.set(key, category)
      categoriesCreated++
    }

    const existing = await prisma.menuItem.findFirst({
      where: {
        restaurantId,
        categoryId: category.id,
        name: { equals: row.name, mode: 'insensitive' },
        archived: false,
      },
      select: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }

    await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: category.id,
        name: row.name,
        description: row.description,
        price: row.price,
        available: true,
      },
    })
    created++
  }

  return { created, skipped, categoriesCreated, errors }
}

/** Costo ingredienti per piatto (da ricetta/magazzino). */
export async function loadMenuFoodCostMap(
  restaurantId: string,
  menuItemIds: string[],
): Promise<Map<string, { ingredientCost: number; marginPct: number | null; foodCostPct: number | null }>> {
  if (menuItemIds.length === 0) return new Map()

  const items = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId },
    select: {
      id: true,
      price: true,
      inventoryLinks: {
        include: { inventoryItem: { select: { cost: true } } },
      },
    },
  })

  const map = new Map<string, { ingredientCost: number; marginPct: number | null; foodCostPct: number | null }>()
  for (const item of items) {
    const ingredientCost = item.inventoryLinks.reduce(
      (sum, link) => sum + link.quantity * moneyNumber(link.inventoryItem.cost),
      0,
    )
    const price = moneyNumber(item.price)
    const roundedCost = Math.round(ingredientCost * 100) / 100
    const marginPct = price > 0 ? Math.round(((price - roundedCost) / price) * 1000) / 10 : null
    const foodCostPct = price > 0 ? Math.round((roundedCost / price) * 1000) / 10 : null
    map.set(item.id, { ingredientCost: roundedCost, marginPct, foodCostPct })
  }
  return map
}
