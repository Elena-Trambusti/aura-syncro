/**
 * Tenant demo per vendite — tavoli, menu, clienti VIP, ordini storici.
 * Uso: npm run db:seed-demo
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { OBSIDIAN_ROOM_TEMPLATE, DEFAULT_TABLE_POSITIONS_PERCENT } from '../src/lib/floorPlanTemplates'

const prisma = new PrismaClient()

const DEMO_SLUG = 'aura-demo'
const DEMO_EMAIL = 'demo@aurasyncro.it'
const DEMO_PASSWORD = 'AuraDemo2026!'

async function main() {
  console.log('🎬 Seed tenant demo...\n')

  let restaurant = await prisma.restaurant.findUnique({
    where: { slug: DEMO_SLUG },
    include: { settings: true },
  })

  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: 'Ristorante Demo Aura',
        slug: DEMO_SLUG,
        address: 'Via Demo 1, Milano',
        email: DEMO_EMAIL,
        phone: '+39 02 1234567',
        isSetupComplete: true,
        colorTheme: '#c9a227',
        settings: {
          create: {
            countryCode: 'IT',
            taxRegion: 'IT_MAIN',
            taxRate: 10,
            taxId: 'IT00000000000',
            hasActiveSubscription: true,
            planTier: 'PRO',
            posIntegrationMode: 'SIMULATION',
            posProviderLabel: 'Demo — configurare in setup',
          },
        },
      },
      include: { settings: true },
    })
    console.log('✓ Ristorante demo creato')
  } else {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { isSetupComplete: true },
    })
    console.log('✓ Ristorante demo esistente aggiornato')
  }

  const restaurantId = restaurant.id

  const ownerExists = await prisma.user.findFirst({
    where: { restaurantId, email: DEMO_EMAIL },
  })
  if (!ownerExists) {
    await prisma.user.create({
      data: {
        restaurantId,
        name: 'Demo Owner',
        email: DEMO_EMAIL,
        password: await bcrypt.hash(DEMO_PASSWORD, 12),
        role: 'OWNER',
      },
    })
    console.log(`✓ Owner: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`)
  }

  const tableCount = await prisma.table.count({ where: { restaurantId } })
  if (tableCount < 6) {
    for (const t of DEFAULT_TABLE_POSITIONS_PERCENT) {
      await prisma.table.upsert({
        where: { restaurantId_number: { restaurantId, number: t.number } },
        update: { posX: t.posX, posY: t.posY, shape: t.shape, area: t.area, seats: t.seats },
        create: {
          restaurantId,
          number: t.number,
          seats: t.seats,
          shape: t.shape,
          area: t.area,
          status: t.number === 1 ? 'OCCUPIED' : 'FREE',
          posX: t.posX,
          posY: t.posY,
        },
      })
    }
    console.log('✓ Tavoli 1-8 (coordinate %)')
  }

  await prisma.restaurantSettings.upsert({
    where: { restaurantId },
    create: { restaurantId, floorPlanLayout: OBSIDIAN_ROOM_TEMPLATE },
    update: { floorPlanLayout: OBSIDIAN_ROOM_TEMPLATE },
  })
  console.log('✓ Layout pavimento 2.5D')

  let category = await prisma.menuCategory.findFirst({
    where: { restaurantId, name: 'Piatti demo' },
  })
  if (!category) {
    category = await prisma.menuCategory.create({
      data: { restaurantId, name: 'Piatti demo', sortOrder: 0 },
    })
    const dishes = [
      { name: 'Tagliata demo', price: 24 },
      { name: 'Risotto demo', price: 16 },
      { name: 'Tiramisù demo', price: 8 },
    ]
    for (const [i, d] of dishes.entries()) {
      await prisma.menuItem.create({
        data: {
          restaurantId,
          categoryId: category.id,
          name: d.name,
          price: d.price,
          available: true,
          sortOrder: i,
        },
      })
    }
    console.log('✓ Menu demo')
  }

  const { ensureDefaultLoyaltyTiers } = await import('../src/lib/loyaltyHelpers')
  await ensureDefaultLoyaltyTiers(restaurantId)

  const goldTier = await prisma.loyaltyTier.findFirst({
    where: { restaurantId, name: 'Gold' },
  })

  let vip = await prisma.customer.findFirst({
    where: { restaurantId, email: 'vip.demo@example.com' },
  })
  if (!vip) {
    vip = await prisma.customer.create({
      data: {
        restaurantId,
        firstName: 'Maria',
        lastName: 'VIP Demo',
        name: 'Maria VIP Demo',
        email: 'vip.demo@example.com',
        phone: '+393331112233',
        loyaltyPoints: 520,
        loyaltyTierId: goldTier?.id,
        totalVisits: 12,
        totalSpent: 890,
        tags: ['VIP'],
      },
    })
    console.log('✓ Cliente VIP demo (Gold -10%)')
  }

  console.log('\n✅ Demo pronta:')
  console.log(`   Login: ${DEMO_EMAIL}`)
  console.log(`   Password: ${DEMO_PASSWORD}`)
  console.log(`   Menu QR: /menu/${DEMO_SLUG}?tavolo=1`)
  console.log(`   Slug: ${DEMO_SLUG}\n`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
