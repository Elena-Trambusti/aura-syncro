import { Router, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantId, tenantNotFound } from '../lib/tenant'
import { moneyNumber, toMoney } from '../lib/money'

export const cashRouter = Router()

// GET /cash/session/current - Get the current open session
cashRouter.get('/session/current', requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await prisma.cashRegisterSession.findFirst({
    where: { restaurantId: tenantId(req), status: 'OPEN' },
    include: { openedBy: { select: { name: true } } },
    orderBy: { openedAt: 'desc' },
  })
  res.json(session || null)
})

// POST /cash/session/open - Open a new session
cashRouter.post('/session/open', requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    openingBalance: z.number().min(0).default(0),
    notes: z.string().optional(),
  })
  
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  try {
    const session = await prisma.$transaction(async (tx) => {
      const existing = await tx.cashRegisterSession.findFirst({
        where: { restaurantId: tenantId(req), status: 'OPEN' },
      })
      if (existing) throw new Error('ALREADY_OPEN')

      return tx.cashRegisterSession.create({
        data: {
          restaurantId: tenantId(req),
          openedById: req.userId!,
          openingBalance: toMoney(result.data.openingBalance),
          notes: result.data.notes,
          status: 'OPEN',
        },
      })
    }, { isolationLevel: 'Serializable' })

    res.status(201).json(session)
  } catch (err: any) {
    if (err.message === 'ALREADY_OPEN') {
      res.status(400).json({ error: 'C\'è già un turno cassa aperto.' })
      return
    }
    throw err
  }
})

// POST /cash/session/close - Close current session (Blind Drop)
cashRouter.post('/session/close', requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    closingBalance: z.number().min(0),
    notes: z.string().optional(),
  })
  
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  try {
    const closed = await prisma.$transaction(async tx => {
      const session = await tx.cashRegisterSession.findFirst({
        where: { restaurantId: tenantId(req), status: 'OPEN' },
      })
      if (!session) {
        throw Object.assign(new Error('NO_OPEN_SESSION'), { code: 'NO_OPEN_SESSION' })
      }

      const txs = await tx.cashTransaction.findMany({
        where: { sessionId: session.id },
      })

      let expectedBalance = moneyNumber(session.openingBalance)
      for (const cashTx of txs) {
        const amt = moneyNumber(cashTx.amount)
        if (cashTx.type === 'SALE' || cashTx.type === 'PAYIN') {
          expectedBalance += amt
        } else if (cashTx.type === 'PAYOUT' || cashTx.type === 'REFUND') {
          expectedBalance -= amt
        }
      }

      const difference = result.data.closingBalance - expectedBalance

      const closedCount = await tx.cashRegisterSession.updateMany({
        where: { id: session.id, restaurantId: tenantId(req), status: 'OPEN' },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedById: req.userId!,
          closingBalance: toMoney(result.data.closingBalance),
          expectedBalance: toMoney(expectedBalance),
          difference: toMoney(difference),
          notes: result.data.notes
            ? `${session.notes ? session.notes + '\n' : ''}Chiusura: ${result.data.notes}`
            : session.notes,
        },
      })

      if (closedCount.count === 0) {
        throw Object.assign(new Error('ALREADY_CLOSED'), { code: 'ALREADY_CLOSED' })
      }

      return tx.cashRegisterSession.findFirst({
        where: { id: session.id, restaurantId: tenantId(req) },
      })
    }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 20_000 })

    res.json(closed)
  } catch (err) {
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
    if (code === 'NO_OPEN_SESSION') {
      res.status(400).json({ error: 'Nessun turno cassa aperto da chiudere.', code })
      return
    }
    if (code === 'ALREADY_CLOSED') {
      res.status(409).json({ error: 'Turno cassa già chiuso da un altro operatore.', code })
      return
    }
    throw err
  }
})

// POST /cash/transactions - Add a transaction (payout/payin)
cashRouter.post('/transactions', requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    type: z.enum(['PAYIN', 'PAYOUT']),
    amount: z.number().positive(),
    reason: z.string().min(1),
  })
  
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const session = await prisma.cashRegisterSession.findFirst({
    where: { restaurantId: tenantId(req), status: 'OPEN' },
  })
  
  if (!session) {
    res.status(400).json({ error: 'Devi aprire un turno cassa per registrare movimenti extra.' })
    return
  }

  const tx = await prisma.cashTransaction.create({
    data: {
      sessionId: session.id,
      userId: req.userId!,
      type: result.data.type,
      amount: toMoney(result.data.amount),
      reason: result.data.reason,
    },
  })
  
  res.status(201).json(tx)
})

// GET /cash/transactions - List transactions of current session
cashRouter.get('/transactions', requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await prisma.cashRegisterSession.findFirst({
    where: { restaurantId: tenantId(req), status: 'OPEN' },
  })
  
  if (!session) {
    res.json([])
    return
  }

  const txs = await prisma.cashTransaction.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } }, order: { select: { id: true, table: { select: { number: true } } } } },
  })
  
  res.json(txs)
})

// POST /cash/orders/:orderId/refund — registra rimborso contanti e aggiorna ordine
cashRouter.post('/orders/:orderId/refund', requirePermission('orders.pay'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({
    amount: z.number().positive().optional(),
    reason: z.string().optional(),
  })
  const result = schema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Dati non validi' })
    return
  }

  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, restaurantId: tenantId(req), status: 'PAID' },
    select: { id: true, total: true, refundedAt: true },
  })
  if (!order) {
    tenantNotFound(res, 'Ordine non trovato o non rimborsabile')
    return
  }
  if (order.refundedAt) {
    res.status(409).json({ error: 'Ordine già rimborsato', code: 'ORDER_ALREADY_REFUNDED' })
    return
  }

  const session = await prisma.cashRegisterSession.findFirst({
    where: { restaurantId: tenantId(req), status: 'OPEN' },
  })
  if (!session) {
    res.status(400).json({ error: 'Apri un turno cassa per registrare il rimborso.', code: 'CASH_SESSION_REQUIRED' })
    return
  }

  const refundAmount = result.data.amount ?? moneyNumber(order.total)

  try {
    const { executeOrderRefund } = await import('../lib/orderRefund')
    const { refundAmount: refunded } = await executeOrderRefund({
      orderId: order.id,
      restaurantId: tenantId(req),
      amount: refundAmount,
      reason: result.data.reason,
      userId: req.userId!,
      cashSessionId: session.id,
    })
    res.json({ success: true, refundAmount: refunded })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'ORDER_NOT_REFUNDABLE' || code === 'ORDER_ALREADY_REFUNDED') {
      res.status(409).json({ error: 'Ordine non rimborsabile', code })
      return
    }
    throw err
  }
})
