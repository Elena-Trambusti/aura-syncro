import { prisma } from './prisma'
import { sendEmail, renderTemplate } from './email'
import { splitCustomerName } from './crmCustomer'
import { getTargetCustomers } from './marketingTargets'
import { recordAutomationSend, shouldSendAutomation } from './marketingDedup'
import { calendarDateInTimezone } from './dates'
import { automationEmailSubject } from './marketingAutomationSubjects'

export async function sendCampaignEmails(
  restaurantId: string,
  campaign: { subject?: string | null; message: string; name: string },
  recipients: Array<{ email: string | null; name: string }>,
): Promise<{ sent: number; failed: number }> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true },
  })

  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    if (!recipient.email) continue
    const { firstName } = splitCustomerName(recipient.name)
    const body = renderTemplate(campaign.message, {
      firstName,
      name: recipient.name,
      restaurantName: restaurant?.name ?? 'Il nostro ristorante',
    })
    const result = await sendEmail({
      to: recipient.email,
      subject: campaign.subject || campaign.name,
      text: body,
    })
    if (result.sent) sent += 1
    else failed += 1
  }

  return { sent, failed }
}

export async function runMarketingAutomations(restaurantId: string): Promise<number> {
  const automations = await prisma.marketingAutomation.findMany({
    where: { restaurantId, isActive: true },
  })
  if (automations.length === 0) return 0

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, timezone: true, settings: { select: { defaultLocale: true } } },
  })
  const timeZone = restaurant?.timezone ?? 'Europe/Rome'
  const defaultLocale = restaurant?.settings?.defaultLocale ?? 'it-IT'
  const restaurantName = restaurant?.name ?? ''

  let sentCount = 0
  const todayStr = calendarDateInTimezone(timeZone)
  const today = new Date(`${todayStr}T12:00:00`)

  async function trySend(
    type: import('@prisma/client').AutomationType,
    customerId: string,
    email: string,
    subject: string,
    body: string,
  ): Promise<void> {
    if (!(await shouldSendAutomation(restaurantId, type, customerId, timeZone))) return
    const r = await sendEmail({ to: email, subject, text: body })
    if (r.sent) {
      await recordAutomationSend(restaurantId, type, customerId, timeZone)
      sentCount += 1
    }
  }

  for (const auto of automations) {
    if (auto.type === 'BIRTHDAY') {
      const customers = await prisma.customer.findMany({
        where: { restaurantId, birthdate: { not: null }, email: { contains: '@' } },
      })
      for (const c of customers) {
        if (!c.birthdate || !c.email) continue
        const bd = new Date(c.birthdate)
        const birthdayThisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        const diffDays = Math.round((birthdayThisYear.getTime() - today.getTime()) / 86_400_000)
        if (diffDays !== 3) continue
        const { firstName } = splitCustomerName(c.name)
        const body = renderTemplate(auto.messageTemplate, {
          firstName,
          name: c.name,
          restaurantName,
        })
        await trySend(
          'BIRTHDAY',
          c.id,
          c.email,
          automationEmailSubject('BIRTHDAY', defaultLocale, { restaurantName }),
          body,
        )
      }
    }

    if (auto.type === 'WIN_BACK') {
      const inactiveSince = new Date(today)
      inactiveSince.setDate(inactiveSince.getDate() - 90)
      const inactiveUntil = new Date(today)
      inactiveUntil.setDate(inactiveUntil.getDate() - 45)

      const customers = await prisma.customer.findMany({
        where: {
          restaurantId,
          email: { contains: '@' },
          OR: [
            { lastVisit: { gte: inactiveSince, lt: inactiveUntil } },
            { lastVisit: null, createdAt: { gte: inactiveSince, lt: inactiveUntil } },
          ],
        },
      })
      for (const c of customers) {
        if (!c.email) continue
        const { firstName } = splitCustomerName(c.name)
        const body = renderTemplate(auto.messageTemplate, { firstName, name: c.name, restaurantName })
        await trySend(
          'WIN_BACK',
          c.id,
          c.email,
          automationEmailSubject('WIN_BACK', defaultLocale, { restaurantName }),
          body,
        )
      }
    }

    if (auto.type === 'VIP_THANKS') {
      const yesterdayStart = new Date(today)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)
      const yesterdayEnd = new Date(today)

      const customers = await prisma.customer.findMany({
        where: {
          restaurantId,
          email: { contains: '@' },
          lastVisit: { gte: yesterdayStart, lt: yesterdayEnd },
          OR: [
            { tags: { has: 'VIP' } },
            { totalSpent: { gte: 200 } },
          ],
        },
      })
      for (const c of customers) {
        if (!c.email) continue
        const { firstName } = splitCustomerName(c.name)
        const body = renderTemplate(auto.messageTemplate, {
          firstName,
          name: c.name,
          restaurantName,
        })
        await trySend(
          'VIP_THANKS',
          c.id,
          c.email,
          automationEmailSubject('VIP_THANKS', defaultLocale, { restaurantName }),
          body,
        )
      }
    }

    if (auto.type === 'REQUEST_REVIEW') {
      const now = new Date()
      const endWindow = new Date(now.getTime() - 1 * 60 * 60 * 1000)
      const startWindow = new Date(now.getTime() - 2 * 60 * 60 * 1000)

      const customers = await prisma.customer.findMany({
        where: {
          restaurantId,
          email: { contains: '@' },
          lastVisit: { gte: startWindow, lt: endWindow },
          totalSpent: { gte: 50 },
        },
      })
      for (const c of customers) {
        if (!c.email) continue
        const { firstName } = splitCustomerName(c.name)
        const body = renderTemplate(auto.messageTemplate, {
          firstName,
          name: c.name,
          restaurantName,
        })
        await trySend(
          'REQUEST_REVIEW',
          c.id,
          c.email,
          automationEmailSubject('REQUEST_REVIEW', defaultLocale, { restaurantName }),
          body,
        )
      }
    }
  }

  return sentCount
}

export async function processScheduledCampaigns(): Promise<number> {
  const staleSendingCutoff = new Date(Date.now() - 30 * 60 * 1000)
  await prisma.campaign.updateMany({
    where: {
      status: 'SENDING',
      updatedAt: { lt: staleSendingCutoff },
    },
    data: { status: 'SCHEDULED' },
  })

  const due = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
      restaurant: { subscriptionPlan: 'PREMIUM' }
    },
  })

  let processed = 0
  for (const campaign of due) {
    const claimed = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: 'SCHEDULED' },
      data: { status: 'SENDING' },
    })
    if (claimed.count === 0) continue

    try {
      const recipients = await getTargetCustomers(campaign.restaurantId, campaign.targetFilter ?? null)
      const { sent } = await sendCampaignEmails(campaign.restaurantId, campaign, recipients)
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          recipientCount: sent,
        },
      })
      processed += 1
    } catch (err) {
      await prisma.campaign.updateMany({
        where: { id: campaign.id, status: 'SENDING' },
        data: { status: 'SCHEDULED' },
      })
      console.error('[scheduler] Campagna fallita dopo claim SENDING:', campaign.id, err)
    }
  }
  return processed
}

export async function runAllMarketingJobs(): Promise<{ campaigns: number; automations: number }> {
  const campaigns = await processScheduledCampaigns()

  const restaurants = await prisma.restaurant.findMany({
    where: { subscriptionPlan: 'PREMIUM' },
    select: { id: true },
  })

  let automations = 0
  for (const { id } of restaurants) {
    try {
      automations += await runMarketingAutomations(id)
    } catch (err) {
      console.error('[scheduler] Automazioni marketing fallite:', id, err)
    }
  }

  return { campaigns, automations }
}
