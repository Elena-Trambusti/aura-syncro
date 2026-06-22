import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { settingsForRegistration } from '../src/lib/taxEngine'
import { ensureDefaultTables } from '../src/lib/defaultTables'

const prisma = new PrismaClient()

const EMAIL = 'aurasyncro@gmail.com'
const NAME = 'Elena Trambusti'
const RESTAURANT_NAME = 'Aura Syncro'
/** Cambia subito dopo il primo accesso */
const TEMP_PASSWORD = 'AuraSyncro2026!'

async function main() {
  let created = false
  let user = await prisma.user.findFirst({
    where: { email: EMAIL },
    include: {
      restaurant: { include: { settings: true } },
    },
  })

  if (!user) {
    console.log('Account non trovato, creazione in corso...')
    const slug = `aura-syncro-${Date.now()}`
    const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 12)
    const fiscalSettings = settingsForRegistration('IT', 'IT_MAIN')

    const restaurant = await prisma.restaurant.create({
      data: {
        name: RESTAURANT_NAME,
        slug,
        email: EMAIL,
        colorTheme: '#c9a227',
        timezone: 'Europe/Rome',
        isSetupComplete: true,
        settings: {
          create: {
            ...fiscalSettings,
            hasActiveSubscription: true,
            planTier: 'PRO',
          },
        },
        users: {
          create: {
            name: NAME,
            email: EMAIL,
            password: hashedPassword,
            role: 'OWNER',
          },
        },
      },
      include: { users: true, settings: true },
    })

    user = await prisma.user.findFirst({
      where: { id: restaurant.users[0].id },
      include: { restaurant: { include: { settings: true } } },
    })
    created = true
    console.log('Account creato.')
  } else {
    const resetPassword = process.argv.includes('--reset-password')
    const userUpdateData: { email: string; name: string; password?: string } = {
      email: EMAIL,
      name: NAME,
    }
    if (resetPassword) {
      userUpdateData.password = await bcrypt.hash(TEMP_PASSWORD, 12)
      console.log('Password reimpostata alla temporanea.')
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      }),
      prisma.restaurant.update({
        where: { id: user.restaurantId },
        data: {
          name: RESTAURANT_NAME,
          email: EMAIL,
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
    console.log('Account esistente aggiornato.')
  }

  if (!user) throw new Error('Creazione account fallita')

  const tablesCreated = await ensureDefaultTables(user.restaurantId)
  if (tablesCreated > 0) {
    console.log(`Creati ${tablesCreated} tavoli predefiniti.`)
  }

  const summary = await prisma.user.findFirst({
    where: { email: EMAIL },
    select: {
      email: true,
      name: true,
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

  console.log('\n✅ Accesso sviluppatore attivo:')
  console.log(JSON.stringify(summary, null, 2))
  console.log('\nLogin su https://aurasyncro.com')
  console.log('Email:', EMAIL)
  console.log(created || process.argv.includes('--reset-password')
    ? `Password temporanea: ${TEMP_PASSWORD}`
    : 'Password: usa quella già impostata (oppure riesegui con --reset-password)')
  console.log('\n⚠️  Cambia la password dopo il primo accesso.')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
