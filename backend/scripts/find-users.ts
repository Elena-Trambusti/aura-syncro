import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'elena', mode: 'insensitive' } },
        { email: { contains: 'aurasyncro', mode: 'insensitive' } },
        { email: { contains: 'trambusti', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          isSetupComplete: true,
          settings: { select: { hasActiveSubscription: true, planTier: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log('Trovati', users.length, 'utenti:')
  console.log(JSON.stringify(users, null, 2))

  const allOwners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    select: { email: true, name: true, createdAt: true, restaurant: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  console.log('\nUltimi 10 OWNER:')
  console.log(JSON.stringify(allOwners, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
