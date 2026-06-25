import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const cutoffDate = new Date('2026-06-25T00:00:00Z') // Data teorica di Go-Live
  const testEmails = ['test', 'example', 'ospite', 'demo']

  console.log('--- AURA SYNCRO DRY RUN: TEST DATA ANALYSIS ---')

  // 1. UTENTI
  const totalUsers = await prisma.user.count()
  const testUsers = await prisma.user.count({
    where: {
      OR: testEmails.map(t => ({ email: { contains: t, mode: Prisma.QueryMode.insensitive } })),
    }
  })
  console.log(`\n[User] Totali: ${totalUsers} | Identificati come Test: ${testUsers} | Da preservare (Reali): ${totalUsers - testUsers}`)

  // 2. CLIENTI
  const totalCustomers = await prisma.customer.count()
  const testCustomers = await prisma.customer.count({
    where: {
      OR: [
        ...testEmails.map(t => ({ email: { contains: t, mode: Prisma.QueryMode.insensitive } })),
        { name: { contains: 'test', mode: Prisma.QueryMode.insensitive } }
      ]
    }
  })
  console.log(`[Customer] Totali: ${totalCustomers} | Identificati come Test: ${testCustomers} | Da preservare (Reali): ${totalCustomers - testCustomers}`)

  // 3. ORDINI
  const totalOrders = await prisma.order.count()
  const testOrders = await prisma.order.count({
    where: {
      OR: [
        { customer: { email: { contains: 'test', mode: Prisma.QueryMode.insensitive } } },
        { customer: { name: { contains: 'test', mode: Prisma.QueryMode.insensitive } } },
        { stripeSessionId: { contains: 'test', mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: 'test', mode: Prisma.QueryMode.insensitive } }
      ]
    }
  })
  console.log(`[Order] Totali: ${totalOrders} | Identificati come Test: ${testOrders} | Da preservare (Reali): ${totalOrders - testOrders}`)

  // 4. PRENOTAZIONI
  const totalReservations = await prisma.reservation.count()
  const testReservations = await prisma.reservation.count({
    where: {
      OR: [
        { guestEmail: { contains: 'test', mode: Prisma.QueryMode.insensitive } },
        { guestName: { contains: 'test', mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: 'test', mode: Prisma.QueryMode.insensitive } }
      ]
    }
  })
  console.log(`[Reservation] Totali: ${totalReservations} | Identificati come Test: ${testReservations} | Da preservare (Reali): ${totalReservations - testReservations}`)

  console.log('\nNessun dato è stato cancellato. Questa è solo una scansione (Dry Run).')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
