/**
 * Migrazione multi-tenant: crea il tenant di default e associa i record orfani.
 * Eseguire con: npm run db:seed-tenant
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_SLUG = 'la-bella-italia'
const DEFAULT_NAME = 'La Bella Italia'
const DEFAULT_COLOR = '#c9a227'

async function assignOrphans(model: string, update: () => Promise<{ count: number }>) {
  const result = await update()
  if (result.count > 0) {
    console.log(`  ✓ ${model}: ${result.count} record associati al tenant di default`)
  }
}

async function main() {
  console.log('🏢 Migrazione multi-tenant in corso...\n')

  // Preferisce il ristorante demo con dati reali
  let defaultRestaurant =
    (await prisma.restaurant.findUnique({ where: { slug: 'ristorante-demo' } })) ??
    (await prisma.restaurant.findUnique({ where: { slug: DEFAULT_SLUG } }))

  if (defaultRestaurant) {
    defaultRestaurant = await prisma.restaurant.update({
      where: { id: defaultRestaurant.id },
      data: {
        name: DEFAULT_NAME,
        colorTheme: defaultRestaurant.colorTheme || DEFAULT_COLOR,
        logoUrl: defaultRestaurant.logoUrl ?? defaultRestaurant.logo,
      },
    })
  } else {
    defaultRestaurant = await prisma.restaurant.create({
      data: {
        name: DEFAULT_NAME,
        slug: DEFAULT_SLUG,
        colorTheme: DEFAULT_COLOR,
        address: 'Via Roma 1, Milano',
        email: 'info@labellaitalia.it',
        settings: { create: { taxId: 'B12345678' } },
      },
    })
  }

  const validRestaurantIds = new Set(
    (await prisma.restaurant.findMany({ select: { id: true } })).map(r => r.id),
  )

  const tenantId = defaultRestaurant.id
  console.log(`Tenant di default: "${DEFAULT_NAME}" (${tenantId})\n`)

  // Record con restaurantId non valido → riassocia al tenant di default
  const orphanFilter = { restaurantId: { notIn: [...validRestaurantIds] } }

  await assignOrphans('Table', () =>
    prisma.table.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('MenuCategory', () =>
    prisma.menuCategory.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('MenuItem', () =>
    prisma.menuItem.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('Order', () =>
    prisma.order.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('Reservation', () =>
    prisma.reservation.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('Customer', () =>
    prisma.customer.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('Shift', () =>
    prisma.shift.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('InventoryItem', () =>
    prisma.inventoryItem.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('LoyaltyTier', () =>
    prisma.loyaltyTier.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('Campaign', () =>
    prisma.campaign.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('WaitlistEntry', () =>
    prisma.waitlistEntry.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('User', () =>
    prisma.user.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )
  await assignOrphans('LoyaltyTransaction', () =>
    prisma.loyaltyTransaction.updateMany({ where: orphanFilter, data: { restaurantId: tenantId } }),
  )

  // Sincronizza logoUrl da logo per tutti i ristoranti
  const restaurants = await prisma.restaurant.findMany({ where: { logoUrl: null, logo: { not: null } } })
  for (const r of restaurants) {
    await prisma.restaurant.update({ where: { id: r.id }, data: { logoUrl: r.logo } })
  }

  const counts = await Promise.all([
    prisma.table.count({ where: { restaurantId: tenantId } }),
    prisma.customer.count({ where: { restaurantId: tenantId } }),
    prisma.order.count({ where: { restaurantId: tenantId } }),
    prisma.menuItem.count({ where: { restaurantId: tenantId } }),
  ])

  console.log('\n📊 Record nel tenant di default:')
  console.log(`  Tavoli: ${counts[0]} | Clienti: ${counts[1]} | Ordini: ${counts[2]} | Piatti: ${counts[3]}`)
  console.log('\n✅ Migrazione multi-tenant completata.')
}

main()
  .catch(err => {
    console.error('❌ Errore migrazione:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
