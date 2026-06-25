import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seed del database in corso...')

  const hashedPassword = await bcrypt.hash('admin123', 12)

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'ristorante-demo' },
    update: { colorTheme: '#c9a227', isSetupComplete: true },
    create: {
      name: 'Ristorante La Bella Italia',
      slug: 'ristorante-demo',
      colorTheme: '#c9a227',
      isSetupComplete: true,
      address: 'Via Roma 1, Milano',
      phone: '+39 02 1234567',
      email: 'info@labellaitalai.it',
      description: 'Il miglior ristorante italiano di Milano',
      settings: {
        create: {
          openTime: '12:00',
          closeTime: '23:00',
          countryCode: 'IT',
          taxRegion: 'IT_MAIN',
          defaultLocale: 'it',
          taxRate: 10,
          taxId: 'IT12345678901',
        },
      },
    },
  })

  await prisma.user.upsert({
    where: { restaurantId_email: { restaurantId: restaurant.id, email: 'admin@demo.it' } },
    update: { password: hashedPassword, role: 'OWNER', active: true },
    create: {
      name: 'Mario Rossi',
      email: 'admin@demo.it',
      password: hashedPassword,
      role: 'OWNER',
      restaurantId: restaurant.id,
    },
  })

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: restaurant.id },
    update: {
      hasActiveSubscription: true,
      planTier: 'PRO',
    },
    create: {
      restaurantId: restaurant.id,
      hasActiveSubscription: true,
      planTier: 'PRO',
      openTime: '12:00',
      closeTime: '23:00',
      countryCode: 'IT',
      taxRegion: 'IT_MAIN',
      defaultLocale: 'it',
      taxRate: 10,
      taxId: 'IT12345678901',
    },
  })

  const staffData = [
    { name: 'Marco Bianchi', email: 'marco@demo.it', role: 'WAITER' as const },
    { name: 'Sofia Ferrari', email: 'sofia@demo.it', role: 'CHEF' as const },
    { name: 'Luca Conti', email: 'luca@demo.it', role: 'MANAGER' as const },
  ]
  for (const s of staffData) {
    const existing = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, email: s.email } })
    if (!existing) {
      await prisma.user.create({ data: { restaurantId: restaurant.id, ...s, password: await bcrypt.hash('demo123', 12) } })
    }
  }

  // Tavoli (posX e posY in percentuale 0-100)
  const tableData = [
    // Area Sala (Metà superiore)
    { number: 1, seats: 2, posX: 5, posY: 10, area: 'Sala', shape: 'SQUARE' as const, rotation: 0 },
    { number: 2, seats: 4, posX: 30, posY: 10, area: 'Sala', shape: 'RECTANGLE' as const, rotation: 0 },
    { number: 3, seats: 4, posX: 55, posY: 10, area: 'Sala', shape: 'SQUARE' as const, rotation: 0 },
    { number: 4, seats: 6, posX: 80, posY: 10, area: 'Sala', shape: 'RECTANGLE' as const, rotation: 0 },
    { number: 5, seats: 2, posX: 5, posY: 35, area: 'Sala', shape: 'ROUND' as const, rotation: 0 },
    { number: 6, seats: 4, posX: 30, posY: 35, area: 'Sala', shape: 'SQUARE' as const, rotation: 0 },
    { number: 7, seats: 4, posX: 55, posY: 35, area: 'Sala', shape: 'RECTANGLE' as const, rotation: 0 },
    { number: 8, seats: 8, posX: 80, posY: 35, area: 'Sala', shape: 'RECTANGLE' as const, rotation: 0 },
    
    // Area Terrazza (Metà inferiore)
    { number: 9, seats: 2, posX: 15, posY: 60, area: 'Terrazza', shape: 'ROUND' as const, rotation: 0 },
    { number: 10, seats: 4, posX: 45, posY: 60, area: 'Terrazza', shape: 'SQUARE' as const, rotation: 0 },
    { number: 11, seats: 4, posX: 75, posY: 60, area: 'Terrazza', shape: 'ROUND' as const, rotation: 0 },
    { number: 12, seats: 6, posX: 15, posY: 85, area: 'Terrazza', shape: 'RECTANGLE' as const, rotation: 0 },
    { number: 13, seats: 2, posX: 45, posY: 85, area: 'Terrazza', shape: 'SQUARE' as const, rotation: 0 },
    { number: 14, seats: 8, posX: 75, posY: 85, area: 'Terrazza', shape: 'RECTANGLE' as const, rotation: 0 },
  ]

  for (const t of tableData) {
    await prisma.table.upsert({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: t.number } },
      update: { posX: t.posX, posY: t.posY, area: t.area, shape: t.shape, rotation: t.rotation, seats: t.seats },
      create: { restaurantId: restaurant.id, ...t },
    })
  }

  // Menu
  const antipastiCat = await prisma.menuCategory.upsert({
    where: { id: 'cat-antipasti' },
    update: {},
    create: { id: 'cat-antipasti', restaurantId: restaurant.id, name: 'Antipasti', sortOrder: 1 },
  })
  const primiCat = await prisma.menuCategory.upsert({
    where: { id: 'cat-primi' },
    update: {},
    create: { id: 'cat-primi', restaurantId: restaurant.id, name: 'Primi Piatti', sortOrder: 2 },
  })
  const secondiCat = await prisma.menuCategory.upsert({
    where: { id: 'cat-secondi' },
    update: {},
    create: { id: 'cat-secondi', restaurantId: restaurant.id, name: 'Secondi Piatti', sortOrder: 3 },
  })
  const dolciCat = await prisma.menuCategory.upsert({
    where: { id: 'cat-dolci' },
    update: {},
    create: { id: 'cat-dolci', restaurantId: restaurant.id, name: 'Dolci', sortOrder: 4 },
  })
  const beverageCat = await prisma.menuCategory.upsert({
    where: { id: 'cat-bevande' },
    update: {},
    create: { id: 'cat-bevande', restaurantId: restaurant.id, name: 'Bevande', sortOrder: 5 },
  })

  const menuItemsData = [
    { id: 'item-1', categoryId: antipastiCat.id, name: 'Bruschetta al Pomodoro', price: 8, description: 'Pane tostato con pomodori freschi, basilico e olio EVO', allergens: 'glutine', preparationTime: 5, featured: true },
    { id: 'item-2', categoryId: antipastiCat.id, name: 'Tagliere Salumi e Formaggi', price: 16, description: 'Selezione di salumi e formaggi italiani DOP', allergens: 'latte', preparationTime: 5 },
    { id: 'item-3', categoryId: antipastiCat.id, name: 'Burrata con Prosciutto Crudo', price: 14, description: 'Burrata di Andria con prosciutto di Parma 24 mesi', allergens: 'latte', preparationTime: 5, featured: true },
    { id: 'item-4', categoryId: primiCat.id, name: 'Spaghetti alla Carbonara', price: 14, description: 'Ricetta tradizionale romana con guanciale, pecorino e uova', allergens: 'glutine,uova,latte', preparationTime: 15, featured: true },
    { id: 'item-5', categoryId: primiCat.id, name: 'Risotto ai Funghi Porcini', price: 16, description: 'Riso Carnaroli mantecato con porcini freschi e parmigiano', allergens: 'latte', preparationTime: 20 },
    { id: 'item-6', categoryId: primiCat.id, name: 'Pappardelle al Ragù di Cinghiale', price: 17, description: 'Pasta fresca all\'uovo con ragù di cinghiale toscano', allergens: 'glutine,uova', preparationTime: 15 },
    { id: 'item-7', categoryId: primiCat.id, name: 'Gnocchi alla Sorrentina', price: 13, description: 'Gnocchi di patate con sugo di pomodoro e mozzarella', allergens: 'glutine,latte', preparationTime: 12 },
    { id: 'item-8', categoryId: secondiCat.id, name: 'Tagliata di Manzo', price: 26, description: 'Controfiletto di manzo con rucola, parmigiano e scaglie di tartufo', allergens: 'latte', preparationTime: 20, featured: true },
    { id: 'item-9', categoryId: secondiCat.id, name: 'Branzino al Forno con Erbe', price: 24, description: 'Branzino intero al forno con erbe aromatiche e limone', allergens: 'pesce', preparationTime: 25 },
    { id: 'item-10', categoryId: secondiCat.id, name: 'Pollo alla Cacciatora', price: 18, description: 'Pollo ruspante in umido con pomodori, olive e capperi', preparationTime: 30 },
    { id: 'item-11', categoryId: dolciCat.id, name: 'Tiramisù della Casa', price: 7, description: 'Ricetta originale con savoiardi, mascarpone e caffè', allergens: 'glutine,uova,latte', preparationTime: 3, featured: true },
    { id: 'item-12', categoryId: dolciCat.id, name: 'Panna Cotta ai Frutti di Bosco', price: 6, description: 'Panna cotta artigianale con coulis di frutti di bosco', allergens: 'latte', preparationTime: 3 },
    { id: 'item-13', categoryId: beverageCat.id, name: 'Acqua Naturale 0.75L', price: 2.5, preparationTime: 1 },
    { id: 'item-14', categoryId: beverageCat.id, name: 'Acqua Frizzante 0.75L', price: 2.5, preparationTime: 1 },
    { id: 'item-15', categoryId: beverageCat.id, name: 'Vino Rosso della Casa', price: 5, description: 'Calice di vino rosso locale', preparationTime: 1, featured: true },
    { id: 'item-16', categoryId: beverageCat.id, name: 'Birra Artigianale', price: 5, description: 'Birra artigianale locale 0.4L', allergens: 'glutine', preparationTime: 1 },
  ]

  for (const item of menuItemsData) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: { restaurantId: restaurant.id, ...item },
    })
  }

  // Inventario
  const inventoryData = [
    { name: 'Farina 00', unit: 'kg', quantity: 25, minQuantity: 5, cost: 1.2, category: 'Secchi', supplier: 'Mulino Rossi' },
    { name: 'Pomodori Pelati', unit: 'kg', quantity: 15, minQuantity: 5, cost: 1.8, category: 'Conserve', supplier: 'Ortolano SRL' },
    { name: 'Olio EVO', unit: 'L', quantity: 8, minQuantity: 3, cost: 8.5, category: 'Condimenti', supplier: 'Oleificio Bianchi' },
    { name: 'Parmigiano Reggiano', unit: 'kg', quantity: 3, minQuantity: 1, cost: 24, category: 'Latticini', supplier: 'Caseificio Emilia' },
    { name: 'Guanciale', unit: 'kg', quantity: 2.5, minQuantity: 1, cost: 12, category: 'Carni', supplier: 'Macelleria Roma' },
    { name: 'Uova Fresche', unit: 'pz', quantity: 60, minQuantity: 24, cost: 0.3, category: 'Freschi', supplier: 'Fattoria Verde' },
    { name: 'Riso Carnaroli', unit: 'kg', quantity: 8, minQuantity: 2, cost: 3.5, category: 'Secchi', supplier: 'Riseria Po' },
    { name: 'Funghi Porcini Secchi', unit: 'g', quantity: 500, minQuantity: 150, cost: 0.08, category: 'Secchi', supplier: 'Ortolano SRL' },
    { name: 'Mozzarella di Bufala', unit: 'kg', quantity: 2, minQuantity: 1, cost: 16, category: 'Latticini', supplier: 'Caseificio Caserta' },
    { name: 'Branzino Fresco', unit: 'kg', quantity: 4, minQuantity: 2, cost: 18, category: 'Pesce', supplier: 'Pescheria Blu' },
    { name: 'Controfiletto Manzo', unit: 'kg', quantity: 5, minQuantity: 2, cost: 28, category: 'Carni', supplier: 'Macelleria Roma' },
    { name: 'Mascarpone', unit: 'kg', quantity: 1.5, minQuantity: 0.5, cost: 7, category: 'Latticini', supplier: 'Caseificio Emilia' },
  ]

  for (const item of inventoryData) {
    const existing = await prisma.inventoryItem.findFirst({
      where: { restaurantId: restaurant.id, name: item.name },
    })
    if (!existing) {
      await prisma.inventoryItem.create({ data: { restaurantId: restaurant.id, ...item } })
    }
  }

  // Clienti demo
  const customersData = [
    {
      firstName: 'Giovanni', lastName: 'Ricci', name: 'Giovanni Ricci',
      email: 'giovanni.ricci@email.it', phone: '+39 333 1234567',
      totalVisits: 12, totalSpent: 480, loyaltyPoints: 240,
      tags: ['VIP', 'Vino Rosso'],
    },
    {
      firstName: 'Maria', lastName: 'Lombardi', name: 'Maria Lombardi',
      email: 'maria.lombardi@email.it', phone: '+39 347 7654321',
      totalVisits: 8, totalSpent: 320, loyaltyPoints: 160,
      tags: ['Celiaco'],
    },
    {
      firstName: 'Francesco', lastName: 'Marino', name: 'Francesco Marino',
      email: 'f.marino@email.it', phone: '+39 320 9876543',
      totalVisits: 3, totalSpent: 95, loyaltyPoints: 47,
      tags: [],
    },
    {
      firstName: 'Alessia', lastName: 'Costa', name: 'Alessia Costa',
      email: 'a.costa@email.it', phone: '+39 388 4567890',
      totalVisits: 25, totalSpent: 1200, loyaltyPoints: 600,
      tags: ['VIP'],
    },
  ]

  for (const c of customersData) {
    await prisma.customer.upsert({
      where: { restaurantId_email: { restaurantId: restaurant.id, email: c.email } },
      update: {},
      create: { restaurantId: restaurant.id, ...c },
    })
  }

  // --- WOW DATA FOR SANDBOX DEMO ---
  // Turni staff settimana corrente
  const existingShifts = await prisma.shift.count({ where: { restaurantId: restaurant.id } })
  if (existingShifts === 0) {
    const staffMembers = await prisma.user.findMany({ where: { restaurantId: restaurant.id, email: { not: 'admin@demo.it' } } })
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Lunedì

    for (const member of staffMembers) {
      for (let i = 0; i < 5; i++) {
        const shiftDate = new Date(startOfWeek)
        shiftDate.setDate(startOfWeek.getDate() + i)
        await prisma.shift.create({
          data: {
            restaurantId: restaurant.id,
            userId: member.id,
            date: new Date(shiftDate),
            startTime: '10:00',
            endTime: '18:00',
          }
        })
      }
    }
  }

  // Ordini attivi e completati (Fatturato ~380€)
  const existingOrders = await prisma.order.count({ where: { restaurantId: restaurant.id } })
  if (existingOrders === 0) {
    const tables = await prisma.table.findMany({ where: { restaurantId: restaurant.id } })
    const items = await prisma.menuItem.findMany({ where: { restaurantId: restaurant.id } })
    
    // 4 ordini completati oggi = ~384€
    for (let i = 0; i < 4; i++) {
      const orderDate = new Date()
      orderDate.setHours(12 + i, 30, 0, 0)
      const orderItems = [
        { menuItemId: items[0].id, quantity: 2, unitPrice: items[0].price },
        { menuItemId: items[3].id, quantity: 2, unitPrice: items[3].price },
        { menuItemId: items[7].id, quantity: 2, unitPrice: items[7].price },
      ]
      const subtotal = orderItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)
      await prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          tableId: tables[i].id,
          status: 'PAID',
          subtotal,
          total: subtotal,
          revenueAmount: subtotal,
          createdAt: orderDate,
          items: { create: orderItems }
        }
      })
    }

    // Tavolo 4 e 5: OPEN (Blu)
    await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tables.find(t => t.number === 4)!.id,
        status: 'PREPARING',
        subtotal: 45, total: 45, revenueAmount: 45,
        items: { create: [
          { menuItemId: items[1].id, quantity: 1, unitPrice: items[1].price },
          { menuItemId: items[8].id, quantity: 1, unitPrice: items[8].price }
        ]}
      }
    })
    await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tables.find(t => t.number === 5)!.id,
        status: 'PREPARING',
        subtotal: 28, total: 28, revenueAmount: 28,
        items: { create: [
          { menuItemId: items[4].id, quantity: 1, unitPrice: items[4].price },
          { menuItemId: items[12].id, quantity: 2, unitPrice: items[12].price }
        ]}
      }
    })

    // Tavolo 7: PAYMENT_PENDING (Ambra)
    await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tables.find(t => t.number === 7)!.id,
        status: 'SERVED',
        subtotal: 65, total: 65, revenueAmount: 65,
        items: { create: [
          { menuItemId: items[2].id, quantity: 2, unitPrice: items[2].price },
          { menuItemId: items[9].id, quantity: 2, unitPrice: items[9].price }
        ]}
      }
    })

    // Ordini Passati (per storico e statistiche)
    for (let d = 1; d <= 7; d++) {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - d)
      for (let i = 0; i < 3; i++) {
        pastDate.setHours(19 + i, 0, 0, 0)
        await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            tableId: tables[i].id,
            status: 'PAID',
            subtotal: 45 + (i * 10),
            total: 45 + (i * 10),
            revenueAmount: 45 + (i * 10),
            createdAt: pastDate,
            items: { create: [
              { menuItemId: items[0].id, quantity: 2, unitPrice: items[0].price },
              { menuItemId: items[8].id, quantity: 1, unitPrice: items[8].price }
            ]}
          }
        })
      }
    }
  }

  // --- PRENOTAZIONI ---
  const existingReservations = await prisma.reservation.count({ where: { restaurantId: restaurant.id } })
  if (existingReservations === 0) {
    const tables = await prisma.table.findMany({ where: { restaurantId: restaurant.id } })
    const today = new Date()
    
    // Stasera: Tavolo 2 (Sala)
    const res1 = new Date(today)
    res1.setHours(20, 30, 0, 0)
    await prisma.reservation.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tables.find(t => t.number === 2)!.id,
        guestName: 'Luca Moretti',
        guestPhone: '+39 333 1122334',
        covers: 4,
        date: res1,
        status: 'CONFIRMED'
      }
    })

    // Stasera: Tavolo 11 (Terrazza)
    const res2 = new Date(today)
    res2.setHours(21, 0, 0, 0)
    await prisma.reservation.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tables.find(t => t.number === 11)!.id,
        guestName: 'Chiara Rinaldi',
        guestPhone: '+39 347 9988776',
        covers: 2,
        date: res2,
        status: 'CONFIRMED',
        notes: 'Anniversario, tavolo vista'
      }
    })

    // Domani: Tavolo 8 (Sala - 8 posti)
    const res3 = new Date(today)
    res3.setDate(res3.getDate() + 1)
    res3.setHours(20, 0, 0, 0)
    await prisma.reservation.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tables.find(t => t.number === 8)!.id,
        guestName: 'Azienda Tech SRL',
        guestPhone: '+39 02 88776655',
        covers: 8,
        date: res3,
        status: 'CONFIRMED',
        notes: 'Cena aziendale'
      }
    })
    
    // Aggiorna lo stato dei tavoli riservati per stasera
    await prisma.table.updateMany({
      where: { id: { in: [tables.find(t => t.number === 2)!.id, tables.find(t => t.number === 11)!.id] } },
      data: { status: 'RESERVED' }
    })
  }

  console.log('✅ Seed completato!')
  console.log(`📧 Login: admin@demo.it | Password: admin123`)
  console.log(`🏠 Ristorante: ${restaurant.name}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
