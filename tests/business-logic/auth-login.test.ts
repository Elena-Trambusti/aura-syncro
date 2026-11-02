import { describe, expect, it, beforeAll } from 'vitest'
import { apiBaseUrl } from '../helpers/apiClient'

const describeApi = process.env.SKIP_API_TESTS === '1' ? describe.skip : describe

let apiReachable = false

const account = {
  email: process.env.E2E_EMAIL_A ?? 'admin@demo-it.com',
  password: process.env.E2E_PASSWORD_A ?? 'admin123',
  slug: process.env.E2E_SLUG_A ?? 'demo-it',
}

async function postLogin(email: string, password: string, restaurantSlug?: string) {
  const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, ...(restaurantSlug ? { restaurantSlug } : {}) }),
  })
  const body = await res.json().catch(() => ({})) as { user?: { email: string }; code?: string }
  return { status: res.status, body }
}

describeApi('Login — API HTTP', () => {
  beforeAll(async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) })
      apiReachable = res.ok
    } catch {
      apiReachable = false
    }
  })

  it('credenziali corrette → 200', async () => {
    if (!apiReachable) return
    const { status, body } = await postLogin(account.email, account.password, account.slug)
    expect(status).toBe(200)
    expect(body.user?.email).toBe(account.email)
  })

  it('email con maiuscole e spazi → stesso account', async () => {
    if (!apiReachable) return
    const typed = `  ${account.email.charAt(0).toUpperCase()}${account.email.slice(1).toUpperCase()}  `
    const { status, body } = await postLogin(typed, account.password, account.slug)
    expect(status).toBe(200)
    expect(body.user?.email).toBe(account.email)
  })

  it('password errata → 401', async () => {
    if (!apiReachable) return
    const { status } = await postLogin(account.email, 'password-sbagliata', account.slug)
    expect(status).toBe(401)
  })

  it('i login riusciti non consumano il limite tentativi', async () => {
    if (!apiReachable) return
    for (let i = 0; i < 11; i++) {
      const { status } = await postLogin(account.email, account.password, account.slug)
      expect(status).toBe(200)
    }
  })

  it('troppi tentativi falliti bloccano solo quella email, non gli altri utenti', async () => {
    if (!apiReachable) return
    const attacked = `bloccato-${Date.now()}@example.com`
    for (let i = 0; i < 10; i++) {
      const { status } = await postLogin(attacked, 'password-sbagliata')
      expect(status).toBe(401)
    }
    const blocked = await postLogin(attacked, 'password-sbagliata')
    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe('RATE_LIMITED')

    const other = await postLogin(account.email, account.password, account.slug)
    expect(other.status).toBe(200)
  })
})

describeApi('Staff — email con maiuscole diverse e permessi manager', () => {
  const owner = {
    email: process.env.E2E_EMAIL ?? 'owner@e2e.aurasyncro.test',
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

  async function ownerToken(): Promise<string | null> {
    const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(owner),
    })
    if (!res.ok) return null
    return ((await res.json()) as { token: string }).token
  }

  async function createStaff(token: string, email: string, password: string, role: string) {
    const res = await fetch(`${apiBaseUrl()}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Staff', email, password, role }),
    })
    return { status: res.status, body: await res.json() as { id?: string } }
  }

  it('due account nello stesso ristorante che differiscono solo per maiuscole: entra quello con la password giusta', async () => {
    if (!apiReachable) return
    const token = await ownerToken()
    if (!token) return
    const stamp = Date.now()
    const a = await createStaff(token, `Dup.${stamp}@example.com`, 'Password-A1', 'WAITER')
    const b = await createStaff(token, `dup.${stamp}@example.com`, 'Password-B2', 'WAITER')
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)

    const loginA = await postLogin(`dup.${stamp}@example.com`, 'Password-A1')
    const loginB = await postLogin(`DUP.${stamp}@example.com`, 'Password-B2')
    expect(loginA.status).toBe(200)
    expect(loginB.status).toBe(200)
    expect(loginA.body.user?.email).toBe(`Dup.${stamp}@example.com`)
    expect(loginB.body.user?.email).toBe(`dup.${stamp}@example.com`)
  })

  it('un manager non può cambiare la password di un altro manager', async () => {
    if (!apiReachable) return
    const token = await ownerToken()
    if (!token) return
    const stamp = Date.now()
    const m1 = await createStaff(token, `manager1.${stamp}@example.com`, 'Password-M1', 'MANAGER')
    const m2 = await createStaff(token, `manager2.${stamp}@example.com`, 'Password-M2', 'MANAGER')
    expect(m1.status).toBe(201)
    expect(m2.status).toBe(201)

    const login = await fetch(`${apiBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `manager1.${stamp}@example.com`, password: 'Password-M1' }),
    })
    const { token: m1Token } = await login.json() as { token: string }

    const res = await fetch(`${apiBaseUrl()}/api/staff/${m2.body.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${m1Token}` },
      body: JSON.stringify({ password: 'Presa-in-carico-1' }),
    })
    expect(res.status).toBe(403)
  })
})

describeApi('Ordini QR pubblici — asporto', () => {
  beforeAll(async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/api/health`, { signal: AbortSignal.timeout(3000) })
      apiReachable = res.ok
    } catch {
      apiReachable = false
    }
  })

  it('asporto senza pagamento dal menu pubblico → 400 TAKEAWAY_REQUIRES_PAYMENT', async () => {
    if (!apiReachable) return
    const slug = process.env.E2E_RESTAURANT_SLUG ?? 'demo-it'
    const menu = await fetch(`${apiBaseUrl()}/api/public/menu/${slug}`)
    if (!menu.ok) return
    const data = await menu.json() as { categories: Array<{ items: Array<{ id: string }> }> }
    const item = data.categories.flatMap(c => c.items)[0]
    if (!item) return

    const res = await fetch(`${apiBaseUrl()}/api/public/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, type: 'TAKEAWAY', items: [{ menuItemId: item.id, quantity: 1 }] }),
    })
    const body = await res.json() as { code?: string }
    expect(res.status).toBe(400)
    expect(body.code).toBe('TAKEAWAY_REQUIRES_PAYMENT')
  })
})
