import { describe, expect, it, beforeAll } from 'vitest'
import { apiFetch, apiBaseUrl, loginApi, type AuthSession } from '../helpers/apiClient'

const describeApi = process.env.SKIP_API_TESTS === '1' ? describe.skip : describe

const creds = {
  email: process.env.E2E_EMAIL ?? 'admin@demo-it.com',
  password: process.env.E2E_PASSWORD ?? 'admin123',
  slug: process.env.E2E_RESTAURANT_SLUG ?? 'demo-it',
}

let apiReachable = false
let session: AuthSession

async function findOccupiedTable(s: AuthSession): Promise<{ id: string; number: number } | null> {
  const res = await apiFetch('/api/tables', s)
  if (!res.ok) return null
  const tables = (await res.json()) as Array<{ id: string; number: number; status: string }>
  const occupied = tables.find(t => t.status === 'OCCUPIED')
  if (occupied) return occupied

  const free = tables.find(t => t.status === 'FREE')
  if (!free) return null

  const menuRes = await apiFetch('/api/menu/categories', s)
  if (!menuRes.ok) return null
  const categories = (await menuRes.json()) as Array<{ items: Array<{ id: string; available: boolean }> }>
  const menuItem = categories.flatMap(c => c.items).find(i => i.available)
  if (!menuItem) return null

  const orderRes = await apiFetch('/api/orders', s, {
    method: 'POST',
    body: JSON.stringify({
      tableId: free.id,
      type: 'DINE_IN',
      items: [{ menuItemId: menuItem.id, quantity: 1 }],
    }),
  })
  if (!orderRes.ok) return null

  const tablesRes = await apiFetch('/api/tables', s)
  if (!tablesRes.ok) return null
  const refreshed = (await tablesRes.json()) as Array<{ id: string; number: number; status: string }>
  const nowOccupied = refreshed.find(t => t.id === free.id && t.status === 'OCCUPIED')
  return nowOccupied ?? { id: free.id, number: free.number }
}

describeApi('Premium ops — API HTTP', () => {
  beforeAll(async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) })
      apiReachable = res.ok
      if (apiReachable) {
        session = await loginApi(creds.email, creds.password, creds.slug)
      }
    } catch {
      apiReachable = false
    }
  })

  it('GET /api/health/ready risponde 200 con db ok', async () => {
    if (!apiReachable) return
    const res = await fetch(`${apiBaseUrl()}/api/health/ready`)
    expect(res.status).toBe(200)
    const body = await res.json() as { status?: string; db?: string }
    expect(body.status).toBe('ready')
    expect(body.db).toBe('ok')
  })

  it('GET /api/restaurant/compliance-status restituisce score e checks', async () => {
    if (!apiReachable) return
    const res = await apiFetch('/api/restaurant/compliance-status', session)
    expect(res.status).toBe(200)
    const body = await res.json() as { score: number; checks: Array<{ id: string; ok: boolean }> }
    expect(typeof body.score).toBe('number')
    expect(body.checks.length).toBeGreaterThan(0)
    expect(body.checks.some(c => c.id === 'taxId')).toBe(true)
  })

  it('GET /api/restaurant/onboarding-readiness elenca controlli sistema', async () => {
    if (!apiReachable) return
    const res = await apiFetch('/api/restaurant/onboarding-readiness', session)
    expect(res.status).toBe(200)
    const body = await res.json() as { checks: Array<{ id: string; ok: boolean }>; readyForService: boolean }
    expect(body.checks.length).toBeGreaterThanOrEqual(5)
    expect(typeof body.readyForService).toBe('boolean')
  })

  it('POST /api/restaurant/onboarding/go-live — demo già completo o success', async () => {
    if (!apiReachable) return
    const res = await apiFetch('/api/restaurant/onboarding/go-live', session, { method: 'POST' })
    expect([200, 409]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.json() as { success?: boolean; alreadyComplete?: boolean }
      expect(body.success).toBe(true)
    }
  })

  it('GET /api/restaurant/print-agent restituisce configured', async () => {
    if (!apiReachable) return
    const res = await apiFetch('/api/restaurant/print-agent', session)
    expect(res.status).toBe(200)
    const body = await res.json() as { configured: boolean }
    expect(typeof body.configured).toBe('boolean')
  })

  it('POST /api/menu/import-csv importa piatto di test', async () => {
    if (!apiReachable) return
    const unique = `E2E CSV ${Date.now()}`
    const csv = `name,price,category\n${unique},11.50,E2E Category`
    const res = await apiFetch('/api/menu/import-csv', session, {
      method: 'POST',
      body: JSON.stringify({ csv }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { created: number; skipped: number; errors: string[] }
    expect(body.created).toBeGreaterThanOrEqual(1)
    expect(body.errors).toHaveLength(0)
  })

  it('POST /api/menu/import-csv rifiuta CSV troppo corto', async () => {
    if (!apiReachable) return
    const res = await apiFetch('/api/menu/import-csv', session, {
      method: 'POST',
      body: JSON.stringify({ csv: 'x' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/tables/:id/claim e /release su tavolo occupato', async () => {
    if (!apiReachable) return
    const table = await findOccupiedTable(session)
    expect(table).not.toBeNull()

    const claimRes = await apiFetch(`/api/tables/${table!.id}/claim`, session, { method: 'POST' })
    expect(claimRes.status).toBe(200)
    const claimed = await claimRes.json() as { servingUserId?: string | null }
    expect(claimed.servingUserId).toBeTruthy()

    const releaseRes = await apiFetch(`/api/tables/${table!.id}/release`, session, { method: 'POST' })
    expect(releaseRes.status).toBe(200)
    const released = await releaseRes.json() as { servingUserId?: string | null }
    expect(released.servingUserId).toBeNull()
  })

  it('GET /api/restaurant/audit-log (OWNER) restituisce entries', async () => {
    if (!apiReachable) return
    const res = await apiFetch('/api/restaurant/audit-log?limit=5', session)
    expect(res.status).toBe(200)
    const body = await res.json() as { count: number; entries: unknown[] }
    expect(typeof body.count).toBe('number')
    expect(Array.isArray(body.entries)).toBe(true)
  })
})
