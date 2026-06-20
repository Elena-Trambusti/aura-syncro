import { AutomationType, CountryCode } from '@prisma/client'
import { prisma } from './prisma'
import { buildFiscalConfig } from './taxEngine'
import { defaultTemplate } from './crmCustomer'

const AUTOMATION_TYPES: AutomationType[] = ['BIRTHDAY', 'WIN_BACK', 'VIP_THANKS']

export async function ensureMarketingAutomations(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { settings: true },
  })
  const countryCode = (restaurant?.settings?.countryCode ?? 'IT') as CountryCode

  const existing = await prisma.marketingAutomation.findMany({
    where: { restaurantId },
  })
  const existingTypes = new Set(existing.map(a => a.type))

  for (const type of AUTOMATION_TYPES) {
    if (!existingTypes.has(type)) {
      await prisma.marketingAutomation.create({
        data: {
          restaurantId,
          type,
          isActive: false,
          messageTemplate: defaultTemplate(type, countryCode),
        },
      })
    }
  }

  return prisma.marketingAutomation.findMany({
    where: { restaurantId },
    orderBy: { type: 'asc' },
  })
}

export async function getRestaurantCountryCode(restaurantId: string): Promise<CountryCode> {
  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } })
  return buildFiscalConfig(settings).countryCode
}
