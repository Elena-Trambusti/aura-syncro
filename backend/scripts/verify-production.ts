/**
 * Verifica rapida produzione — health, readiness, login, endpoint premium ops.
 * Uso: npx tsx scripts/verify-production.ts [baseUrl]
 */
const BASE = (process.argv[2] ?? 'https://aura-syncro-s98ae.ondigitalocean.app').replace(/\/$/, '')
const EMAIL = process.env.E2E_EMAIL ?? 'admin@demo-it.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'admin123'
const SLUG = process.env.E2E_RESTAURANT_SLUG ?? 'demo-it'

type Check = { name: string; ok: boolean; detail: string }

const checks: Check[] = []

async function get(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(15_000) })
  const text = await res.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-json */
  }
  return { res, text, json }
}

async function main() {
  console.log(`\n🔍 Verifica produzione: ${BASE}\n`)

  try {
    const health = await get('/api/health')
    checks.push({
      name: 'GET /api/health',
      ok: health.res.ok,
      detail: health.res.ok ? 'ok' : `HTTP ${health.res.status}`,
    })
  } catch (e) {
    checks.push({ name: 'GET /api/health', ok: false, detail: String(e) })
  }

  try {
    const ready = await get('/api/health/ready')
    const body = ready.json as { status?: string; db?: string } | null
    const ok = ready.res.ok && body?.status === 'ready' && body?.db === 'ok'
    checks.push({
      name: 'GET /api/health/ready',
      ok,
      detail: ok ? 'DB raggiungibile' : ready.res.status === 404
        ? '404 — deploy backend non aggiornato'
        : `HTTP ${ready.res.status} ${ready.text.slice(0, 120)}`,
    })
  } catch (e) {
    checks.push({ name: 'GET /api/health/ready', ok: false, detail: String(e) })
  }

  let token = ''
  let restaurantId = ''
  try {
    const login = await get('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, restaurantSlug: SLUG }),
    })
    const body = login.json as { token?: string; restaurant?: { id: string }; error?: string } | null
    token = body?.token ?? ''
    restaurantId = body?.restaurant?.id ?? ''
    checks.push({
      name: 'POST /api/auth/login',
      ok: login.res.ok && Boolean(token),
      detail: login.res.ok && token
        ? 'login OK'
        : `HTTP ${login.res.status} ${body?.error ?? login.text.slice(0, 120)}`,
    })
  } catch (e) {
    checks.push({ name: 'POST /api/auth/login', ok: false, detail: String(e) })
  }

  if (token && restaurantId) {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'X-Restaurant-Id': restaurantId,
    }
    for (const [label, path] of [
      ['GET /api/restaurant/print-agent', '/api/restaurant/print-agent'],
      ['GET /api/restaurant/compliance-status', '/api/restaurant/compliance-status'],
    ] as const) {
      try {
        const r = await get(path, { headers: authHeaders })
        checks.push({
          name: label,
          ok: r.res.ok,
          detail: r.res.ok ? 'ok' : r.res.status === 404
            ? '404 — deploy backend non aggiornato'
            : `HTTP ${r.res.status}`,
        })
      } catch (e) {
        checks.push({ name: label, ok: false, detail: String(e) })
      }
    }
  }

  for (const c of checks) {
    console.log(`${c.ok ? '✅' : '❌'} ${c.name} — ${c.detail}`)
  }

  const failed = checks.filter(c => !c.ok)
  console.log(`\n${failed.length === 0 ? '✅ Tutti i controlli superati.' : `⚠️  ${failed.length} controllo/i fallito/i.`}\n`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
