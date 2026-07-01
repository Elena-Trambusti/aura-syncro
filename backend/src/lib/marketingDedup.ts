import type { AutomationType } from '@prisma/client'
import { prisma } from './prisma'
import { calendarDateInTimezone } from './dates'

/** Evita invii duplicati automazioni nello stesso giorno calendario tenant. */
export async function shouldSendAutomation(
  restaurantId: string,
  automationType: AutomationType,
  customerId: string,
  timeZone = 'Europe/Rome',
): Promise<boolean> {
  const calendarDay = calendarDateInTimezone(timeZone)
  const existing = await prisma.marketingAutomationSend.findUnique({
    where: {
      restaurantId_automationType_customerId_calendarDay: {
        restaurantId,
        automationType,
        customerId,
        calendarDay,
      },
    },
  })
  return !existing
}

export async function recordAutomationSend(
  restaurantId: string,
  automationType: AutomationType,
  customerId: string,
  timeZone = 'Europe/Rome',
): Promise<void> {
  const calendarDay = calendarDateInTimezone(timeZone)
  await prisma.marketingAutomationSend.upsert({
    where: {
      restaurantId_automationType_customerId_calendarDay: {
        restaurantId,
        automationType,
        customerId,
        calendarDay,
      },
    },
    create: { restaurantId, automationType, customerId, calendarDay },
    update: {},
  })
}
