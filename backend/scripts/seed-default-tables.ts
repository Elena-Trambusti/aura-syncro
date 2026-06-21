/**
 * Crea tavoli predefiniti per ristoranti senza tavoli.
 * Uso: npx tsx scripts/seed-default-tables.ts [email-owner]
 */
import { PrismaClient } from '@prisma/client'
import { ensureDefaultTables } from '../src/lib/defaultTables'

const prisma = new PrismaClient()
const ownerEmail = process.argv[2]

async function main() {
  let restaurants: Array<{ id: string; name: string; slug: string }>

  if (ownerEmail) {
    const owner = await prisma.user.findFirst({
      where: { email: ownerEmail, role: 'OWNER' },
      select: { restaurantId: true, restaurant: { select: { id: true, name: true, slug: true } } },
    })
    if (!owner) {
      console.error('Owner non trovato:', ownerEmail)
      process.exit(1)
    }
    restaurants = [owner.restaurant]
  } else {
    const all = await prisma.restaurant.findMany({ select: { id: true, name: true, slug: true } })
    restaurants = all
  }

  let total = 0
  for (const r of restaurants) {
    const created = await ensureDefaultTables(r.id)
    if (created > 0) {
      console.log(`✓ ${r.name} (${r.slug}): ${created} tavoli creati`)
      total += created
    } else {
      console.log(`— ${r.name}: tavoli già presenti`)
    }
  }

  console.log(`\nFatto. Tavoli creati: ${total}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
