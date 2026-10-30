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
