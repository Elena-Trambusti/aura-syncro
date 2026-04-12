import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const marketingRouter = Router()

// ── Campagne ──────────────────────────────────────────────────────────────────

marketingRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const campaigns = await prisma.campaign.findMany({
    where: { restaurantId: req.restaurantId! },
    orderBy: { createdAt: 'desc' },
  })
  res.json(campaigns)
})

marketingRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
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

marketingRouter.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: req.body,
  })
  res.json(campaign)
})

marketingRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.campaign.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

// ── Preview destinatari ───────────────────────────────────────────────────────

marketingRouter.post('/preview', async (req: AuthRequest, res: Response): Promise<void> => {
  const restaurantId = req.restaurantId!
  const { targetFilter } = req.body

  const recipients = await getTargetCustomers(restaurantId, targetFilter)
  res.json({ count: recipients.length, sample: recipients.slice(0, 5) })
})

// ── Invio campagna ─────────────────────────────────────────────────────────────

marketingRouter.post('/:id/send', async (req: AuthRequest, res: Response): Promise<void> => {
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
  if (!campaign) { res.status(404).json({ error: 'Campagna non trovata' }); return }
  if (campaign.status === 'SENT') { res.status(400).json({ error: 'Campagna già inviata' }); return }

  const recipients = await getTargetCustomers(req.restaurantId!, campaign.targetFilter || null)

  // In produzione qui ci sarebbe l'integrazione con SendGrid/Twilio
  // Per ora simuliamo l'invio e aggiorniamo lo stato
  const updated = await prisma.campaign.update({
    where: { id: req.params.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      recipientCount: recipients.length,
    },
  })

  res.json({
    success: true,
    recipientCount: recipients.length,
    campaign: updated,
    note: 'In produzione verrà inviato tramite provider email/SMS',
  })
})

// ── Automazioni compleanno ─────────────────────────────────────────────────────

marketingRouter.get('/automations/birthdays', async (req: AuthRequest, res: Response): Promise<void> => {
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

marketingRouter.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
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

// ── Helper ─────────────────────────────────────────────────────────────────────

async function getTargetCustomers(restaurantId: string, filterJson: string | null) {
  type Filter = { minSpent?: number; minVisits?: number; tierId?: string; inactiveDays?: number }
  let filter: Filter = {}
  try { if (filterJson) filter = JSON.parse(filterJson) } catch { /* usa filtro vuoto */ }

  const where: Record<string, unknown> = { restaurantId }
  if (filter.minSpent) where.totalSpent = { gte: filter.minSpent }
  if (filter.minVisits) where.totalVisits = { gte: filter.minVisits }
  if (filter.tierId) where.loyaltyTierId = filter.tierId
  if (filter.inactiveDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter.inactiveDays)
    where.lastVisit = { lte: cutoff }
  }

  return prisma.customer.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true },
  })
}
