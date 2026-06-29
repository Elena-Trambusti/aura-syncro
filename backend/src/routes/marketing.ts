import { Router, Response } from 'express'
import { campaignSendLimiter } from '../middleware/rateLimit'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { ensureMarketingAutomations } from '../lib/marketingAutomations'
import { getTargetCustomers, marketingTargetFilterSchema } from '../lib/marketingTargets'
import { scopedWhere, tenantId, tenantNotFound, tenantWhere } from '../lib/tenant'
import { AutomationType } from '@prisma/client'

export const marketingRouter = Router()

// ── Automazioni marketing ─────────────────────────────────────────────────────

marketingRouter.get('/automations', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const automations = await ensureMarketingAutomations(req.restaurantId!)
  res.json(automations)
})

marketingRouter.put('/automations/:type', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const typeSchema = z.nativeEnum(AutomationType)
  const typeResult = typeSchema.safeParse(req.params.type)
  if (!typeResult.success) {
    res.status(400).json({ error: 'Tipo automazione non valido' })
    return
  }

  const schema = z.object({
    isActive: z.boolean().optional(),
    messageTemplate: z.string().min(1).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() })
    return
  }

  await ensureMarketingAutomations(req.restaurantId!)
  const updated = await prisma.marketingAutomation.updateMany({
    where: { restaurantId: req.restaurantId!, type: typeResult.data },
    data: result.data,
  })
  if (updated.count === 0) {
    tenantNotFound(res, 'Automazione non trovata')
    return
  }

  const automation = await prisma.marketingAutomation.findFirst({
    where: { restaurantId: req.restaurantId!, type: typeResult.data },
  })
  res.json(automation)
})

// ── Campagne ──────────────────────────────────────────────────────────────────

marketingRouter.get('/', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const campaigns = await prisma.campaign.findMany({
    where: { restaurantId: req.restaurantId! },
    orderBy: { createdAt: 'desc' },
  })
  res.json(campaigns)
})

marketingRouter.post('/', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1),
    type: z.enum(['EMAIL', 'SMS', 'BIRTHDAY', 'WIN_BACK', 'PROMOTION', 'NEWS']),
    subject: z.string().optional(),
    message: z.string().min(1),
    targetFilter: z.string().optional(),
    scheduledAt: z.string().datetime().optional(),
    discountCode: z.string().optional(),
    discountPct: z.number().min(0).max(100).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi', details: result.error.flatten() }); return }

  const data = result.data
  const campaign = await prisma.campaign.create({
    data: {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      restaurantId: req.restaurantId!,
    },
  })
  res.status(201).json(campaign)
})

marketingRouter.put('/:id', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(['EMAIL', 'SMS', 'BIRTHDAY', 'WIN_BACK', 'PROMOTION', 'NEWS']).optional(),
    subject: z.string().optional().nullable(),
    message: z.string().min(1).optional(),
    targetFilter: z.string().optional().nullable(),
    scheduledAt: z.string().datetime().optional().nullable(),
    discountCode: z.string().optional().nullable(),
    discountPct: z.number().min(0).max(100).optional().nullable(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'CANCELLED']).optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: 'Dati non validi' }); return }

  const updated = await prisma.campaign.updateMany({
    where: scopedWhere(req, req.params.id),
    data: {
      ...result.data,
      ...(result.data.scheduledAt ? { scheduledAt: new Date(result.data.scheduledAt) } : {}),
    },
  })
  if (updated.count === 0) { tenantNotFound(res, 'Campagna non trovata'); return }
  const campaign = await prisma.campaign.findFirst({ where: scopedWhere(req, req.params.id) })
  res.json(campaign)
})

marketingRouter.delete('/:id', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const deleted = await prisma.campaign.deleteMany({ where: scopedWhere(req, req.params.id) })
  if (deleted.count === 0) { tenantNotFound(res, 'Campagna non trovata'); return }
  res.status(204).send()
})

// ── Preview destinatari ───────────────────────────────────────────────────────

marketingRouter.post('/preview', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const parsed = z.object({ targetFilter: marketingTargetFilterSchema }).safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Filtro destinatari non valido', details: parsed.error.flatten() })
    return
  }

  const filterValue = parsed.data.targetFilter
  const recipients = await getTargetCustomers(
    restaurantId,
    filterValue === '' || filterValue == null ? null : filterValue,
  )
  res.json({ count: recipients.length, sample: recipients.slice(0, 5) })
})

// ── Invio campagna ─────────────────────────────────────────────────────────────

marketingRouter.post('/:id/send', campaignSendLimiter, requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const campaign = await prisma.campaign.findFirst({
    where: scopedWhere(req, req.params.id),
  })
  if (!campaign) { tenantNotFound(res, 'Campagna non trovata'); return }

  const recipients = await getTargetCustomers(tenantId(req), campaign.targetFilter || null)

  const claimed = await prisma.campaign.updateMany({
    where: {
      ...scopedWhere(req, req.params.id),
      status: { in: ['DRAFT', 'SCHEDULED'] },
    },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      recipientCount: recipients.length,
    },
  })
  if (claimed.count === 0) {
    res.status(409).json({ error: 'Campagna già inviata o in invio', code: 'CAMPAIGN_ALREADY_SENT' })
    return
  }

  const { sendCampaignEmails } = await import('../lib/marketingSend')
  let sent = 0
  let failed = 0
  try {
    const result = await sendCampaignEmails(tenantId(req), campaign, recipients)
    sent = result.sent
    failed = result.failed
  } catch (err) {
    await prisma.campaign.updateMany({
      where: scopedWhere(req, req.params.id),
      data: { status: campaign.status, sentAt: null, recipientCount: 0 },
    })
    throw err
  }

  const refreshed = await prisma.campaign.findFirst({ where: scopedWhere(req, req.params.id) })

  res.json({
    success: true,
    recipientCount: recipients.length,
    emailsSent: sent,
    emailsFailed: failed,
    campaign: refreshed,
  })
})

// ── Automazioni compleanno ─────────────────────────────────────────────────────

marketingRouter.get('/automations/birthdays', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date()
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const customers = await prisma.customer.findMany({
    where: { restaurantId: req.restaurantId!, birthdate: { not: null } },
    select: { id: true, name: true, email: true, phone: true, birthdate: true, loyaltyPoints: true },
  })

  type BdCustomer = { id: string; name: string; email: string | null; phone: string | null; birthdate: Date | null; loyaltyPoints: number }

  const upcoming = customers.filter((c: BdCustomer) => {
    if (!c.birthdate) return false
    const bd = new Date(c.birthdate)
    const bdThisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
    return bdThisYear >= today && bdThisYear <= nextWeek
  })

  const todayBirthdays = customers.filter((c: BdCustomer) => {
    if (!c.birthdate) return false
    const bd = new Date(c.birthdate)
    return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDay
  })

  res.json({ today: todayBirthdays, upcoming, totalWithBirthdate: customers.filter((c: BdCustomer) => c.birthdate).length })
})

// ── Stats overview ─────────────────────────────────────────────────────────────

marketingRouter.get('/stats', requirePermission('marketing.manage'), async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!

  const [total, sent, draft, scheduled] = await Promise.all([
    prisma.campaign.count({ where: { restaurantId } }),
    prisma.campaign.count({ where: { restaurantId, status: 'SENT' } }),
    prisma.campaign.count({ where: { restaurantId, status: 'DRAFT' } }),
    prisma.campaign.count({ where: { restaurantId, status: 'SCHEDULED' } }),
  ])

  const totalRecipients = await prisma.campaign.aggregate({
    where: { restaurantId, status: 'SENT' },
    _sum: { recipientCount: true },
  })

  res.json({ total, sent, draft, scheduled, totalRecipients: totalRecipients._sum.recipientCount || 0 })
})

