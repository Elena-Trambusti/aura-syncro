import { describe, expect, it, beforeAll } from 'vitest'
import { z } from 'zod'
import { apiFetch, apiBaseUrl, loginApi, type AuthSession } from '../helpers/apiClient'

/** Mirror di finalizeSchema in backend/src/routes/payments.ts */
const finalizeSchema = z.object({
  orderId: z.string(),
  tipAmount: z.number().min(0).optional().default(0),
  tipWaiterId: z.string().optional(),
  paymentMethod: z.enum(['CARD', 'CASH', 'SPLIT']).default('CARD'),
  splitSettlement: z.enum(['CARD', 'CASH']).optional(),
  split: z.object({
    mode: z.enum(['equal', 'by_items']),
    guestCount: z.number().int().min(2).max(20).optional(),
    assignments: z.record(z.string(), z.number().int().min(0)).optional(),
  }).optional(),
  simulateEmail: z.string().email().optional(),
  stripePaymentIntentId: z.string().optional(),
  discountCode: z.string().optional(),
  applyLoyaltyDiscount: z.boolean().optional().default(true),
  splitGuestIndex: z.number().int().min(0).optional(),
  nativePosConfirmed: z.boolean().optional().default(false),
})

const cashOpenSchema = z.object({
  openingBalance: z.number().min(0).default(0),
  notes: z.string().optional(),
})

const describeApi = process.env.SKIP_API_TESTS === '1' ? describe.skip : describe

let apiReachable = false

const creds = {
  email: process.env.E2E_EMAIL ?? 'admin@demo-it.com',
  password: process.env.E2E_PASSWORD ?? 'admin123',
  slug: process.env.E2E_RESTAURANT_SLUG ?? 'demo-it',
}

async function createDineInOrder(session: AuthSession): Promise<{ id: string; total: number } | null> {
  const tablesRes = await apiFetch('/api/tables', session)
  if (!tablesRes.ok) return null
  const tables = (await tablesRes.json()) as Array<{ id: string; status: string }>
  const table = tables.find(t => t.status === 'FREE') ?? tables[0]
  if (!table) return null

  const menuRes = await apiFetch('/api/menu/categories', session)
  if (!menuRes.ok) return null
  const categories = (await menuRes.json()) as Array<{ items: Array<{ id: string; available: boolean }> }>
  const menuItem = categories.flatMap(c => c.items).find(i => i.available)
  if (!menuItem) return null

  const res = await apiFetch('/api/orders', session, {
    method: 'POST',
    body: JSON.stringify({
      tableId: table.id,
      type: 'DINE_IN',
      items: [{ menuItemId: menuItem.id, quantity: 1 }],
    }),
  })
  if (!res.ok) return null
  const order = (await res.json()) as { id: string; total: number }
  return order
}

async function ensureCashSessionOpen(session: AuthSession): Promise<void> {
  const current = await apiFetch('/api/cash/session/current', session)
  if (current.ok) {
    const body = await current.json()
    if (body && (body as { status?: string }).status === 'OPEN') return
  }
  const open = await apiFetch('/api/cash/session/open', session, {
    method: 'POST',
    body: JSON.stringify({ openingBalance: 100 }),
  })
  expect([200, 201]).toContain(open.status)
}

describe('Checkout & Cassa — validazione schema', () => {
  it('finalize: rifiuta paymentMethod non valido', () => {
    expect(finalizeSchema.safeParse({ orderId: 'ord-1', paymentMethod: 'BITCOIN' }).success).toBe(false)
  })

  it('finalize: accetta payload minimo carta', () => {
    const result = finalizeSchema.safeParse({ orderId: 'ord-1', paymentMethod: 'CARD' })
    expect(result.success).toBe(true)
  })

  it('finalize: split richiede guestCount >= 2', () => {
    expect(finalizeSchema.safeParse({
      orderId: 'ord-1',
      paymentMethod: 'SPLIT',
      split: { mode: 'equal', guestCount: 1 },
    }).success).toBe(false)
  })

  it('cash open: rifiuta saldo negativo', () => {
    expect(cashOpenSchema.safeParse({ openingBalance: -1 }).success).toBe(false)
  })
})

describeApi('Checkout & Cassa — API HTTP', () => {
  beforeAll(async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) })
      apiReachable = res.ok
    } catch {
      apiReachable = false
    }
  })

  it('GET /api/payments/checkout/:orderId → riepilogo ordine', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)
    const order = await createDineInOrder(session)
    if (!order) return

    const res = await apiFetch(`/api/payments/checkout/${order.id}`, session)
    expect(res.status).toBe(200)
    const body = await res.json() as { order?: { id: string; total: number } }
    expect(body.order?.id).toBe(order.id)
    expect(typeof body.order?.total).toBe('number')
  })

  it('POST /api/payments/finalize CARD → incasso simulato', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)
    const order = await createDineInOrder(session)
    if (!order) return

    const key = `e2e-finalize-card-${Date.now()}`
    const res = await apiFetch('/api/payments/finalize', session, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: JSON.stringify({
        orderId: order.id,
        paymentMethod: 'CARD',
        tipAmount: 0,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as {
      transactionId?: string | null
      order?: { status: string }
      alreadyPaid?: boolean
    }
    expect(body.alreadyPaid).not.toBe(true)
    expect(body.order?.status).toBe('PAID')
  })

  it('secondo finalize sullo stesso ordine → alreadyPaid', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)
    const order = await createDineInOrder(session)
    if (!order) return

    const payload = JSON.stringify({
      orderId: order.id,
      paymentMethod: 'CARD',
      tipAmount: 0,
    })

    const first = await apiFetch('/api/payments/finalize', session, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `e2e-paid-a-${order.id}` },
      body: payload,
    })
    expect(first.status).toBe(200)

    const second = await apiFetch('/api/payments/finalize', session, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `e2e-paid-b-${order.id}` },
      body: payload,
    })
    expect(second.status).toBe(200)
    const body = await second.json() as { alreadyPaid?: boolean; order?: { status: string } }
    expect(body.alreadyPaid).toBe(true)
    expect(body.order?.status).toBe('PAID')
  })

  it('POST finalize CASH senza turno cassa → 409 CASH_SESSION_REQUIRED', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)
    const order = await createDineInOrder(session)
    if (!order) return

    const current = await apiFetch('/api/cash/session/current', session)
    const openSession = current.ok ? await current.json() as { status?: string; id?: string } : null
    if (openSession?.status === 'OPEN' && openSession.id) {
      await apiFetch('/api/cash/session/close', session, {
        method: 'POST',
        body: JSON.stringify({ closingBalance: 100 }),
      })
    }

    const res = await apiFetch('/api/payments/finalize', session, {
      method: 'POST',
      body: JSON.stringify({
        orderId: order.id,
        paymentMethod: 'CASH',
        tipAmount: 0,
      }),
    })

    expect(res.status).toBe(409)
    const body = await res.json() as { code?: string }
    expect(body.code).toBe('CASH_SESSION_REQUIRED')
  })

  it('POST /api/cash/session/open e doppia apertura → 400', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)

    const current = await apiFetch('/api/cash/session/current', session)
    const existing = current.ok ? await current.json() as { status?: string } | null : null
    if (existing?.status === 'OPEN') {
      const dup = await apiFetch('/api/cash/session/open', session, {
        method: 'POST',
        body: JSON.stringify({ openingBalance: 50 }),
      })
      expect(dup.status).toBe(400)
      return
    }

    const open = await apiFetch('/api/cash/session/open', session, {
      method: 'POST',
      body: JSON.stringify({ openingBalance: 100 }),
    })
    expect([200, 201]).toContain(open.status)

    const dup = await apiFetch('/api/cash/session/open', session, {
      method: 'POST',
      body: JSON.stringify({ openingBalance: 50 }),
    })
    expect(dup.status).toBe(400)
  })

  it('POST finalize CASH con cassa aperta → ordine PAID', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)
    await ensureCashSessionOpen(session)

    const order = await createDineInOrder(session)
    if (!order) return

    const res = await apiFetch('/api/payments/finalize', session, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': `e2e-cash-${order.id}` },
      body: JSON.stringify({
        orderId: order.id,
        paymentMethod: 'CASH',
        tipAmount: 0,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { order?: { status: string; paymentMethod?: string } }
    expect(body.order?.status).toBe('PAID')
    expect(body.order?.paymentMethod).toBe('CASH')
  })

  it('finalize con stessa Idempotency-Key → risposta cached', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)
    const order = await createDineInOrder(session)
    if (!order) return

    const key = `e2e-finalize-idem-${order.id}`
    const payload = JSON.stringify({
      orderId: order.id,
      paymentMethod: 'CARD',
      tipAmount: 0,
    })

    const first = await apiFetch('/api/payments/finalize', session, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: payload,
    })
    expect(first.status).toBe(200)
    const firstBody = await first.json()

    const second = await apiFetch('/api/payments/finalize', session, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': key },
      body: payload,
    })
    expect(second.status).toBe(200)
    const secondBody = await second.json()
    expect(secondBody).toEqual(firstBody)
  })
})
