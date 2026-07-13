/**
 * Rimuove account e dati di test dal database prima del go-live.
 *
 * Criteri email: termina con @example.com oppure contiene "test" (case-insensitive).
 *
 * Uso:
 *   npx tsx scripts/purge-test-accounts.ts           # dry-run (default)
 *   npx tsx scripts/purge-test-accounts.ts --execute # elimina davvero
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { deleteRestaurantCascade } from '../src/lib/deleteRestaurant'
import { isTestEmail, testEmailPrismaFilter } from '../src/lib/testAccountFilter'

const prisma = new PrismaClient()
const execute = process.argv.includes('--execute')

async function deleteTestUser(userId: string, restaurantId: string): Promise<void> {
  await prisma.cashTransaction.deleteMany({
    where: { OR: [{ userId }, { session: { openedById: userId } }] },
  })
  await prisma.cashRegisterSession.deleteMany({ where: { openedById: userId } })
  await prisma.inventoryAdjustment.deleteMany({ where: { userId } })
  await prisma.shift.deleteMany({ where: { userId } })
  await prisma.order.updateMany({ where: { waiterId: userId }, data: { waiterId: null } })
  await prisma.order.updateMany({ where: { tipWaiterId: userId }, data: { tipWaiterId: null } })
  await prisma.cashRegisterSession.updateMany({
    where: { restaurantId, closedById: userId },
    data: { closedById: null },
  })
  await prisma.user.delete({ where: { id: userId } })
}

async function deleteTestCustomer(customerId: string, restaurantId: string): Promise<void> {
  await prisma.loyaltyTransaction.deleteMany({ where: { customerId } })
  await prisma.order.updateMany({
    where: { restaurantId, customerId },
    data: { customerId: null },
  })
  await prisma.reservation.updateMany({
    where: { restaurantId, customerId },
    data: { customerId: null },
  })
  await prisma.customer.delete({ where: { id: customerId } })
}

async function main(): Promise<void> {
  console.log(execute ? '=== ESECUZIONE PURGE TEST ===' : '=== DRY-RUN PURGE TEST (usa --execute) ===\n')

  const testUsers = await prisma.user.findMany({
    where: testEmailPrismaFilter,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      restaurantId: true,
      restaurant: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const testCustomers = await prisma.customer.findMany({
    where: testEmailPrismaFilter,
    select: {
      id: true,
      email: true,
      name: true,
      restaurantId: true,
      restaurant: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const restaurantsWithTestEmail = await prisma.restaurant.findMany({
    where: {
      email: { not: null },
    },
    select: { id: true, name: true, slug: true, email: true },
  })
  const testRestaurantEmailRows = restaurantsWithTestEmail.filter((r) => isTestEmail(r.email))

  const restaurantIdsFromUsers = [...new Set(testUsers.map((u) => u.restaurantId))]
  const restaurantsToEvaluate = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIdsFromUsers } },
    select: {
      id: true,
      name: true,
      slug: true,
      users: { select: { id: true, email: true, role: true } },
    },
  })

  const fullPurgeRestaurantIds: string[] = []
  const partialUserDeletes: typeof testUsers = []

  for (const restaurant of restaurantsToEvaluate) {
    const allUsersTest = restaurant.users.every((u) => isTestEmail(u.email))
    const hasNonTestOwner = restaurant.users.some(
      (u) => u.role === 'OWNER' && !isTestEmail(u.email),
    )

    if (allUsersTest || !hasNonTestOwner) {
      fullPurgeRestaurantIds.push(restaurant.id)
    } else {
      const partial = testUsers.filter((u) => u.restaurantId === restaurant.id)
      partialUserDeletes.push(...partial)
    }
  }

  const partialCustomerDeletes = testCustomers.filter(
    (c) => !fullPurgeRestaurantIds.includes(c.restaurantId),
  )

  console.log(`Utenti test trovati: ${testUsers.length}`)
  for (const u of testUsers) {
    console.log(`  - [${u.role}] ${u.email} (${u.restaurant.slug})`)
  }

  console.log(`\nClienti CRM test trovati: ${testCustomers.length}`)
  for (const c of testCustomers) {
    console.log(`  - ${c.email} (${c.restaurant.slug})`)
  }

  console.log(`\nRistoranti con email test (campo Restaurant.email): ${testRestaurantEmailRows.length}`)
  for (const r of testRestaurantEmailRows) {
    console.log(`  - ${r.email} → ${r.slug}`)
  }

  console.log(`\nRistoranti da eliminare interamente: ${fullPurgeRestaurantIds.length}`)
  for (const id of fullPurgeRestaurantIds) {
    const r = restaurantsToEvaluate.find((x) => x.id === id)
    console.log(`  - ${r?.slug ?? id} (${r?.name ?? '?'})`)
  }

  console.log(`\nUtenti test da rimuovere (tenant conservato): ${partialUserDeletes.length}`)
  for (const u of partialUserDeletes) {
    console.log(`  - ${u.email} (${u.restaurant.slug})`)
  }

  console.log(`\nClienti test da rimuovere (tenant conservato): ${partialCustomerDeletes.length}`)
  for (const c of partialCustomerDeletes) {
    console.log(`  - ${c.email} (${c.restaurant.slug})`)
  }

  if (!execute) {
    console.log('\nNessuna modifica applicata. Ripeti con --execute per procedere.')
    return
  }

  let deletedRestaurants = 0
  let deletedUsers = 0
  let deletedCustomers = 0
  let clearedRestaurantEmails = 0

  for (const restaurantId of fullPurgeRestaurantIds) {
    await prisma.$transaction(async (tx) => {
      await deleteRestaurantCascade(tx, restaurantId)
    })
    deletedRestaurants += 1
  }

  const remainingPartialUsers = partialUserDeletes.filter(
    (u) => !fullPurgeRestaurantIds.includes(u.restaurantId),
  )
  for (const user of remainingPartialUsers) {
    await prisma.$transaction(async (tx) => {
      await deleteTestUser(user.id, user.restaurantId)
    })
    deletedUsers += 1
  }

  const remainingPartialCustomers = partialCustomerDeletes.filter(
    (c) => !fullPurgeRestaurantIds.includes(c.restaurantId),
  )
  for (const customer of remainingPartialCustomers) {
    const stillExists = await prisma.customer.findUnique({ where: { id: customer.id } })
    if (!stillExists) continue
    await prisma.$transaction(async (tx) => {
      await deleteTestCustomer(customer.id, customer.restaurantId)
    })
    deletedCustomers += 1
  }

  for (const restaurant of testRestaurantEmailRows) {
    const stillExists = await prisma.restaurant.findUnique({ where: { id: restaurant.id } })
    if (!stillExists) continue
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { email: null },
    })
    clearedRestaurantEmails += 1
  }

  console.log('\n=== PURGE COMPLETATA ===')
  console.log(`Ristoranti eliminati: ${deletedRestaurants}`)
  console.log(`Utenti eliminati: ${deletedUsers}`)
  console.log(`Clienti CRM eliminati: ${deletedCustomers}`)
  console.log(`Email ristorante azzerate: ${clearedRestaurantEmails}`)
}

main()
  .catch((err) => {
    console.error('Errore purge:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
