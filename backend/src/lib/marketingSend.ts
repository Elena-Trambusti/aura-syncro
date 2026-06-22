import { prisma } from './prisma'
import { sendEmail, renderTemplate } from './email'
import { splitCustomerName } from './crmCustomer'
import { getTargetCustomers } from './marketingTargets'

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
    select: { name: true },
  })

  let sentCount = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const auto of automations) {
    if (auto.type === 'BIRTHDAY') {
      const customers = await prisma.customer.findMany({
        where: { restaurantId, birthdate: { not: null }, email: { not: null } },
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
          restaurantName: restaurant?.name ?? '',
        })
        const r = await sendEmail({ to: c.email, subject: `Auguri da ${restaurant?.name ?? ''}`, text: body })
        if (r.sent) sentCount += 1
      }
    }

    if (auto.type === 'WIN_BACK') {
      const minCutoff = new Date(today)
      minCutoff.setDate(minCutoff.getDate() - 67)
      const maxCutoff = new Date(today)
      maxCutoff.setDate(maxCutoff.getDate() - 60)

      const customers = await prisma.customer.findMany({
        where: {
          restaurantId,
          email: { not: null },
          OR: [
            { lastVisit: { gte: minCutoff, lte: maxCutoff } },
            { lastVisit: null, createdAt: { lte: maxCutoff } },
          ],
        },
      })
      for (const c of customers) {
        if (!c.email) continue
        const { firstName } = splitCustomerName(c.name)
        const body = renderTemplate(auto.messageTemplate, { firstName, name: c.name, restaurantName: restaurant?.name ?? '' })
        const r = await sendEmail({ to: c.email, subject: 'Ci manchi!', text: body })
        if (r.sent) sentCount += 1
      }
    }
  }

  return sentCount
}

export async function processScheduledCampaigns(): Promise<number> {
  const due = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
  })

  let processed = 0
  for (const campaign of due) {
    const recipients = await getTargetCustomers(campaign.restaurantId, campaign.targetFilter ?? null)
    const { sent } = await sendCampaignEmails(campaign.restaurantId, campaign, recipients)
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'SENT', sentAt: new Date(), recipientCount: sent },
    })
    processed += 1
  }
  return processed
}

export async function runAllMarketingJobs(): Promise<{ campaigns: number; automations: number }> {
  const campaigns = await processScheduledCampaigns()

  const restaurants = await prisma.restaurant.findMany({
    where: { settings: { hasActiveSubscription: true } },
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
