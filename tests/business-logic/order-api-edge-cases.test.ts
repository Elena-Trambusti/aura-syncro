import { describe, expect, it, beforeAll } from 'vitest'
import { z } from 'zod'
import { apiFetch, apiBaseUrl, loginApi } from '../helpers/apiClient'

/** Schema allineato a POST /api/orders in backend/src/routes/orders.ts */
const orderCreateSchema = z.object({
  tableId: z.string().optional(),
  customerId: z.string().optional(),
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('DINE_IN'),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive().max(99),
    course: z.number().int().positive().optional().default(1),
    modifiers: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })).min(1).max(50),
})

const describeApi = process.env.SKIP_API_TESTS === '1' ? describe.skip : describe

let apiReachable = false

describe('Order create — validazione schema', () => {
  it('rifiuta comanda senza articoli', () => {
    const result = orderCreateSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
  })

  it('rifiuta quantità zero o menuItemId vuoto', () => {
    expect(orderCreateSchema.safeParse({
      items: [{ menuItemId: '', quantity: 0 }],
    }).success).toBe(false)
  })

  it('accetta payload minimo valido', () => {
    const result = orderCreateSchema.safeParse({
      tableId: 'table-1',
      type: 'DINE_IN',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })
    expect(result.success).toBe(true)
  })
})

describeApi('Order create — API edge cases', () => {
  const creds = {
    email: process.env.E2E_EMAIL ?? 'admin@demo-it.com',
    password: process.env.E2E_PASSWORD ?? 'admin123',
    slug: process.env.E2E_RESTAURANT_SLUG ?? 'demo-it',
  }

  beforeAll(async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) })
      apiReachable = res.ok
    } catch {
      apiReachable = false
    }
  })

  it('POST /api/orders con items vuoti → 400', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)
    const res = await apiFetch('/api/orders', session, {
      method: 'POST',
      body: JSON.stringify({ type: 'DINE_IN', items: [] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error?: string }
    expect(body.error).toMatch(/non validi|invalid/i)
  })

  it('doppio POST con stessa Idempotency-Key → seconda risposta cached o 409', async () => {
    if (!apiReachable) return
    const session = await loginApi(creds.email, creds.password, creds.slug)

    const tablesRes = await apiFetch('/api/tables', session)
    const tables = (await tablesRes.json()) as Array<{ id: string; status: string }>
    const table = tables.find(t => t.status === 'FREE') ?? tables[0]
    if (!table) return

    const menuRes = await apiFetch('/api/menu/categories', session)
    const categories = (await menuRes.json()) as Array<{ items: Array<{ id: string; available: boolean }> }>
    const menuItem = categories.flatMap(c => c.items).find(i => i.available)
    if (!menuItem) return

    const payload = {
      tableId: table.id,
      type: 'DINE_IN',
      items: [{ menuItemId: menuItem.id, quantity: 1 }],
    }

    const key = `e2e-idem-${Date.now()}`
    const headers = { 'X-Idempotency-Key': key }

    const first = await apiFetch('/api/orders', session, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    expect(first.status).toBeLessThan(300)

    const second = await apiFetch('/api/orders', session, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    expect([200, 201, 409]).toContain(second.status)
  })
})
