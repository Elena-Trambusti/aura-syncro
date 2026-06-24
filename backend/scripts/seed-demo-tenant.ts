/**
 * Tenant demo per vendite — tavoli, menu, clienti VIP, ordini storici.
 * Uso: npm run db:seed-demo
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

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
    for (let n = 1; n <= 8; n++) {
      await prisma.table.upsert({
        where: { restaurantId_number: { restaurantId, number: n } },
        update: {},
        create: {
          restaurantId,
          number: n,
          seats: n <= 4 ? 4 : 6,
          status: n === 1 ? 'OCCUPIED' : 'FREE',
          posX: (n % 4) * 120,
          posY: Math.floor((n - 1) / 4) * 100,
        },
      })
    }
    console.log('✓ Tavoli 1-8')
  }

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
