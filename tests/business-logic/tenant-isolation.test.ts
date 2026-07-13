import { describe, expect, it, beforeAll } from 'vitest'
import type { AuthRequest } from '../../backend/src/middleware/auth'
import { scopedWhere, tenantWhere } from '../../backend/src/lib/tenant'
import { clearTenantPrismaCache, createTenantPrisma } from '../../backend/src/lib/tenantPrisma'
import { apiFetch, apiBaseUrl, loginApi } from '../helpers/apiClient'

const describeApi = process.env.SKIP_API_TESTS === '1' ? describe.skip : describe

let apiReachable = false

describe('Tenant isolation — helper puri', () => {
  it('scopedWhere include sempre restaurantId della sessione', () => {
    const req = { restaurantId: 'restaurant-a' } as AuthRequest
    expect(scopedWhere(req, 'table-uuid-1')).toEqual({
      id: 'table-uuid-1',
      restaurantId: 'restaurant-a',
    })
    expect(tenantWhere(req)).toEqual({ restaurantId: 'restaurant-a' })
  })
})

describeApi('Tenant isolation — API HTTP', () => {
  const tenantA = {
    email: process.env.E2E_EMAIL_A ?? 'admin@demo-it.com',
    password: process.env.E2E_PASSWORD_A ?? 'admin123',
    slug: process.env.E2E_SLUG_A ?? 'demo-it',
  }
  const tenantB = {
    email: process.env.E2E_EMAIL_B ?? 'admin@demo-es.com',
    password: process.env.E2E_PASSWORD_B ?? 'admin123',
    slug: process.env.E2E_SLUG_B ?? 'demo-es',
  }

  beforeAll(async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) })
      apiReachable = res.ok
    } catch {
      apiReachable = false
    }
  })

  it('header X-Restaurant-Id diverso dal JWT → 403', async () => {
    if (!apiReachable) return
    const session = await loginApi(tenantA.email, tenantA.password, tenantA.slug)
    const res = await fetch(`${apiBaseUrl()}/api/tables`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'X-Restaurant-Id': 'altro-ristorante-fake',
      },
    })
    expect(res.status).toBe(403)
  })

  it('utente tenant A non può modificare tavolo tenant B', async () => {
    if (!apiReachable) return
    const sessionA = await loginApi(tenantA.email, tenantA.password, tenantA.slug)
    const sessionB = await loginApi(tenantB.email, tenantB.password, tenantB.slug)

    const tablesB = await apiFetch('/api/tables', sessionB)
    expect(tablesB.ok).toBe(true)
    const listB = (await tablesB.json()) as Array<{ id: string; number: number }>
    const foreignTable = listB[0]
    if (!foreignTable) {
      console.warn('Skip: tenant B senza tavoli — eseguire db:seed-demo')
      return
    }

    const attack = await apiFetch(`/api/tables/${foreignTable.id}/status`, sessionA, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'FREE' }),
    })

    expect([403, 404]).toContain(attack.status)
  })

  it('tenantPrisma forza restaurantId sulle query', async () => {
    if (!process.env.DATABASE_URL) return

    clearTenantPrismaCache()
    const { prisma } = await import('../../backend/src/lib/prisma')
    const restaurants = await prisma.restaurant.findMany({ take: 2, select: { id: true } })
    if (restaurants.length < 2) return

    const dbA = createTenantPrisma(restaurants[0].id)
    const tablesA = await dbA.table.findMany({ take: 5 })
    for (const t of tablesA) {
      expect(t.restaurantId).toBe(restaurants[0].id)
    }
  })
})
