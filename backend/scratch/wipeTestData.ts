import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const testEmails = ['test', 'example', 'ospite', 'demo']

  console.log('--- AURA SYNCRO WIPE: RIMOZIONE DATI DI TEST ---')

  // 1. Identificare i record da cancellare
  const testUsers = await prisma.user.findMany({
    where: { OR: testEmails.map(t => ({ email: { contains: t, mode: Prisma.QueryMode.insensitive } })) },
    select: { id: true }
  })
  const userIds = testUsers.map(u => u.id)

  const testCustomers = await prisma.customer.findMany({
    where: {
      OR: [
        ...testEmails.map(t => ({ email: { contains: t, mode: Prisma.QueryMode.insensitive } })),
        { name: { contains: 'test', mode: Prisma.QueryMode.insensitive } }
      ]
    },
    select: { id: true }
  })
  const customerIds = testCustomers.map(c => c.id)

  const testOrders = await prisma.order.findMany({
    where: {
      OR: [
        { customerId: { in: customerIds } }, // ordini dei clienti test
        { stripeSessionId: { contains: 'test', mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: 'test', mode: Prisma.QueryMode.insensitive } }
      ]
    },
    select: { id: true }
  })
  const orderIds = testOrders.map(o => o.id)

  const testReservations = await prisma.reservation.findMany({
    where: {
      OR: [
        { guestEmail: { contains: 'test', mode: Prisma.QueryMode.insensitive } },
        { guestName: { contains: 'test', mode: Prisma.QueryMode.insensitive } },
        { notes: { contains: 'test', mode: Prisma.QueryMode.insensitive } },
        { customerId: { in: customerIds } }
      ]
    },
    select: { id: true }
  })
  const resIds = testReservations.map(r => r.id)

  console.log(`Trovati: ${userIds.length} User, ${customerIds.length} Customer, ${orderIds.length} Order, ${resIds.length} Reservation`)

  if (userIds.length === 0 && customerIds.length === 0 && orderIds.length === 0 && resIds.length === 0) {
    console.log('Nessun record di test trovato da eliminare.')
    return
  }

  // 2. Cancellazione a cascata (Bottom-Up per evitare errori di Foreign Key)
  await prisma.$transaction(async tx => {
    // Prima OrderItems (e i loro modificatori se necessari, ma in schema.prisma 
    // OrderItemModifier dipende da OrderItem, non abbiamo l'id, quindi usiamo un trucco)
    if (orderIds.length > 0) {
      const orderItems = await tx.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true }
      })
      const orderItemIds = orderItems.map(oi => oi.id)
      
      if (orderItemIds.length > 0) {
        await tx.orderItemModifier.deleteMany({
          where: { orderItemId: { in: orderItemIds } }
        })
      }
      
      await tx.orderItem.deleteMany({
        where: { orderId: { in: orderIds } }
      })

      // Elimina anche eventuali Invoices di questi ordini di test
      await tx.invoice.deleteMany({
        where: { orderId: { in: orderIds } }
      })

      // Infine elimina gli ordini
      await tx.order.deleteMany({
        where: { id: { in: orderIds } }
      })
      console.log(`✔ Eliminati ${orderIds.length} Ordini (e relativi piatti/fatture)`)
    }

    if (resIds.length > 0) {
      await tx.reservation.deleteMany({
        where: { id: { in: resIds } }
      })
      console.log(`✔ Eliminate ${resIds.length} Prenotazioni`)
    }

    if (customerIds.length > 0) {


      await tx.loyaltyTransaction.deleteMany({
        where: { customerId: { in: customerIds } }
      })

      await tx.customer.deleteMany({
        where: { id: { in: customerIds } }
      })
      console.log(`✔ Eliminati ${customerIds.length} Clienti`)
    }

    if (userIds.length > 0) {
      await tx.user.deleteMany({
        where: { id: { in: userIds } }
      })
      console.log(`✔ Eliminati ${userIds.length} Utenti`)
    }
  })

  console.log('\nPulizia completata con successo all\'interno di una transazione sicura!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
