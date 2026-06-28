import { PrismaClient, CountryCode, TaxRegion } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const markets = [
  {
    lang: 'it',
    email: 'admin@demo-it.com',
    name: 'La Bella Italia',
    slug: 'demo-it',
    countryCode: 'IT',
    taxRegion: 'IT_MAIN',
    locale: 'it',
    taxRate: 10,
    taxId: 'IT12345678901',
    description: 'Il miglior ristorante italiano di Milano',
    address: 'Via Roma 1, Milano',
    phone: '+39 02 1234567',
    categories: ['Antipasti', 'Primi Piatti', 'Secondi Piatti', 'Dolci', 'Bevande'],
    items: [
      { cIdx: 0, name: 'Bruschetta al Pomodoro', price: 8 },
      { cIdx: 0, name: 'Tagliere Salumi e Formaggi', price: 16 },
      { cIdx: 0, name: 'Burrata con Prosciutto Crudo', price: 14 },
      { cIdx: 1, name: 'Spaghetti alla Carbonara', price: 14 },
      { cIdx: 1, name: 'Risotto ai Funghi Porcini', price: 16 },
      { cIdx: 1, name: 'Gnocchi alla Sorrentina', price: 13 },
      { cIdx: 2, name: 'Tagliata di Manzo', price: 26 },
      { cIdx: 2, name: 'Branzino al Forno', price: 24 },
      { cIdx: 2, name: 'Pollo alla Cacciatora', price: 18 },
      { cIdx: 3, name: 'Tiramisù della Casa', price: 7 },
      { cIdx: 3, name: 'Panna Cotta', price: 6 },
      { cIdx: 4, name: 'Acqua Naturale', price: 2.5 },
      { cIdx: 4, name: 'Vino Rosso della Casa', price: 5 },
    ]
  },
  {
    lang: 'es',
    email: 'admin@demo-es.com',
    name: 'El Toro Loco',
    slug: 'demo-es',
    countryCode: 'ES',
    taxRegion: 'ES_PENINSULA',
    locale: 'es',
    taxRate: 10,
    taxId: 'ESB12345678',
    description: 'El mejor restaurante español de Madrid',
    address: 'Calle Mayor 1, Madrid',
    phone: '+34 91 1234567',
    categories: ['Tapas', 'Primeros', 'Carnes', 'Postres', 'Bebidas'],
    items: [
      { cIdx: 0, name: 'Patatas Bravas', price: 7 },
      { cIdx: 0, name: 'Jamón Ibérico', price: 22 },
      { cIdx: 0, name: 'Croquetas de Jamón', price: 10 },
      { cIdx: 1, name: 'Paella Valenciana', price: 18 },
      { cIdx: 1, name: 'Gazpacho Andaluz', price: 9 },
      { cIdx: 1, name: 'Tortilla de Patatas', price: 12 },
      { cIdx: 2, name: 'Chuletón de Ternera', price: 32 },
      { cIdx: 2, name: 'Secreto Ibérico', price: 24 },
      { cIdx: 2, name: 'Cordero Asado', price: 28 },
      { cIdx: 3, name: 'Crema Catalana', price: 6 },
      { cIdx: 3, name: 'Churros con Chocolate', price: 5 },
      { cIdx: 4, name: 'Agua Mineral', price: 2 },
      { cIdx: 4, name: 'Sangría', price: 12 },
    ]
  },
  {
    lang: 'es-cn',
    email: 'admin@demo-es-cn.com',
    name: 'Canarias Grill',
    slug: 'demo-es-cn',
    countryCode: 'ES',
    taxRegion: 'ES_CANARIAS',
    locale: 'es',
    taxRate: 7, // IGIC
    taxId: 'ESB87654321',
    description: 'Auténtica comida canaria',
    address: 'Avenida Marítima 1, Las Palmas',
    phone: '+34 928 123456',
    categories: ['Entrantes', 'Platos Principales', 'Pescados', 'Postres', 'Bebidas'],
    items: [
      { cIdx: 0, name: 'Papas Arrugadas con Mojo', price: 6 },
      { cIdx: 0, name: 'Queso Asado', price: 8 },
      { cIdx: 0, name: 'Gofio Escaldado', price: 7 },
      { cIdx: 1, name: 'Ropa Vieja', price: 14 },
      { cIdx: 1, name: 'Carne Fiesta', price: 15 },
      { cIdx: 1, name: 'Conejo en Salmorejo', price: 16 },
      { cIdx: 2, name: 'Cherne a la Plancha', price: 19 },
      { cIdx: 2, name: 'Sancocho Canario', price: 21 },
      { cIdx: 2, name: 'Pulpo Frito', price: 18 },
      { cIdx: 3, name: 'Bienmesabe', price: 6 },
      { cIdx: 3, name: 'Frangollo', price: 5 },
      { cIdx: 4, name: 'Agua Mineral', price: 2 },
      { cIdx: 4, name: 'Vino Volcánico', price: 21 },
    ]
  }
]

async function main() {
  console.log('🌱 Seed del database in corso...')

  const hashedPassword = await bcrypt.hash('admin123', 12)

  // Disabilita i vecchi ristoranti demo singoli (se esistono) per evitare conflitti, 
  // oppure aggiorniamo solo i 3 nuovi.

  for (const m of markets) {
    console.log(`\nConfigurando demo per mercato: ${m.lang.toUpperCase()} (${m.name})...`)
    const restaurant = await prisma.restaurant.upsert({
      where: { slug: m.slug },
      update: { colorTheme: '#c9a227', isSetupComplete: true },
      create: {
        name: m.name,
        slug: m.slug,
        colorTheme: '#c9a227',
        isSetupComplete: true,
        address: m.address,
        phone: m.phone,
        email: m.email,
        description: m.description,
        settings: {
          create: {
            openTime: '12:00',
            closeTime: '23:00',
            countryCode: m.countryCode as CountryCode,
            taxRegion: m.taxRegion as TaxRegion,
            defaultLocale: m.locale,
            taxRate: m.taxRate,
            taxId: m.taxId,
          },
        },
      },
    })

    await prisma.user.upsert({
      where: { restaurantId_email: { restaurantId: restaurant.id, email: m.email } },
      update: { password: hashedPassword, role: 'OWNER', active: true },
      create: {
        name: 'Admin ' + m.name,
        email: m.email,
        password: hashedPassword,
        role: 'OWNER',
        restaurantId: restaurant.id,
      },
    })

    await prisma.restaurantSettings.upsert({
      where: { restaurantId: restaurant.id },
      update: { hasActiveSubscription: true, planTier: 'PRO' },
      create: {
        restaurantId: restaurant.id,
        hasActiveSubscription: true,
        planTier: 'PRO',
        openTime: '12:00',
        closeTime: '23:00',
        countryCode: m.countryCode as CountryCode,
        taxRegion: m.taxRegion as TaxRegion,
        defaultLocale: m.locale,
        taxRate: m.taxRate,
        taxId: m.taxId,
      },
    })

    // Staff
    const staffData = [
      { name: 'Staff 1', email: `staff1@${m.slug}.demo`, role: 'WAITER' as const },
      { name: 'Staff 2', email: `staff2@${m.slug}.demo`, role: 'CHEF' as const },
    ]
    for (const s of staffData) {
      const existing = await prisma.user.findFirst({ where: { restaurantId: restaurant.id, email: s.email } })
      if (!existing) {
        await prisma.user.create({ data: { restaurantId: restaurant.id, ...s, password: await bcrypt.hash('demo123', 12) } })
      }
    }

    // Tavoli (semplificati per demo multi-mercato)
    const tableData = [
      { number: 1, seats: 4, posX: 30, posY: 10, area: 'Sala', shape: 'RECTANGLE' as const, rotation: 0 },
      { number: 2, seats: 4, posX: 55, posY: 10, area: 'Sala', shape: 'SQUARE' as const, rotation: 0 },
      { number: 3, seats: 2, posX: 15, posY: 60, area: 'Terrazza', shape: 'ROUND' as const, rotation: 0 },
      { number: 4, seats: 6, posX: 45, posY: 60, area: 'Terrazza', shape: 'SQUARE' as const, rotation: 0 },
    ]

    for (const t of tableData) {
      await prisma.table.upsert({
        where: { restaurantId_number: { restaurantId: restaurant.id, number: t.number } },
        update: { posX: t.posX, posY: t.posY, area: t.area, shape: t.shape, rotation: t.rotation, seats: t.seats },
        create: { restaurantId: restaurant.id, ...t },
      })
    }

    // Menu Categories & Items
    const categoryEntities = []
    for (let i = 0; i < m.categories.length; i++) {
      const catId = `${m.slug}-cat-${i}`
      const cat = await prisma.menuCategory.upsert({
        where: { id: catId },
        update: {},
        create: { id: catId, restaurantId: restaurant.id, name: m.categories[i], sortOrder: i + 1 },
      })
      categoryEntities.push(cat)
    }

    for (let i = 0; i < m.items.length; i++) {
      const item = m.items[i]
      const itemId = `${m.slug}-item-${i}`
      await prisma.menuItem.upsert({
        where: { id: itemId },
        update: {},
        create: { 
          id: itemId, 
          restaurantId: restaurant.id, 
          categoryId: categoryEntities[item.cIdx].id, 
          name: item.name, 
          price: item.price,
          preparationTime: 10,
          featured: i % 3 === 0 
        },
      })
    }

    // Un paio di ordini
    const existingOrders = await prisma.order.count({ where: { restaurantId: restaurant.id } })
    if (existingOrders === 0) {
      const tables = await prisma.table.findMany({ where: { restaurantId: restaurant.id } })
      const items = await prisma.menuItem.findMany({ where: { restaurantId: restaurant.id } })
      
      if (items.length > 2 && tables.length > 1) {
        await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            tableId: tables[0].id,
            status: 'PREPARING',
            subtotal: items[0].price + items[1].price, 
            total: items[0].price + items[1].price,
            revenueAmount: items[0].price + items[1].price,
            items: { create: [
              { menuItemId: items[0].id, quantity: 1, unitPrice: items[0].price },
              { menuItemId: items[1].id, quantity: 1, unitPrice: items[1].price }
            ]}
          }
        })
        await prisma.order.create({
          data: {
            restaurantId: restaurant.id,
            tableId: tables[1].id,
            status: 'PAID',
            subtotal: items[2].price * 2, 
            total: items[2].price * 2,
            revenueAmount: items[2].price * 2,
            createdAt: new Date(Date.now() - 3600000), // 1 ora fa
            items: { create: [
              { menuItemId: items[2].id, quantity: 2, unitPrice: items[2].price }
            ]}
          }
        })
      }
    }
  }

  console.log('\n✅ Seed multi-mercato completato!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
