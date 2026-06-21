import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OLD_EMAIL = 'elenatrambusti2020@gmail.com'
const NEW_EMAIL = 'aurasyncro@gmail.com'

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: OLD_EMAIL },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      restaurantId: true,
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          isSetupComplete: true,
          settings: { select: { id: true, hasActiveSubscription: true, planTier: true } },
        },
      },
    },
  })

  if (!user) {
    console.error('Utente non trovato:', OLD_EMAIL)
    process.exit(1)
  }

  console.log('Stato attuale:', JSON.stringify(user, null, 2))

  const emailTaken = await prisma.user.findFirst({
    where: { email: NEW_EMAIL, id: { not: user.id } },
    select: { id: true },
  })
  if (emailTaken) {
    console.error('Email già in uso da un altro account:', NEW_EMAIL)
    process.exit(1)
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { email: NEW_EMAIL },
    }),
    prisma.restaurant.update({
      where: { id: user.restaurantId },
      data: {
        email: NEW_EMAIL,
        isSetupComplete: true,
      },
    }),
    prisma.restaurantSettings.update({
      where: { restaurantId: user.restaurantId },
      data: {
        hasActiveSubscription: true,
        planTier: 'PRO',
      },
    }),
  ])

  const updated = await prisma.user.findFirst({
    where: { email: NEW_EMAIL },
    select: {
      email: true,
      restaurant: {
        select: {
          name: true,
          slug: true,
          email: true,
          isSetupComplete: true,
          settings: { select: { hasActiveSubscription: true, planTier: true } },
        },
      },
    },
  })

  console.log('\n✅ Account sbloccato e aggiornato:')
  console.log(JSON.stringify(updated, null, 2))
  console.log('\nAccedi con:', NEW_EMAIL, '+ la tua password attuale')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
