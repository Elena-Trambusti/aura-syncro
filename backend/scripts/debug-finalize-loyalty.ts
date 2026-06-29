/** Test finalize CASH con sconto fedeltà (come test-flow) */
const BASE = (process.argv[2] || 'https://aura-syncro-s98ae.ondigitalocean.app').replace(/\/$/, '')
const EMAIL = 'aurasyncro@gmail.com'
const PASSWORD = 'AuraSyncro2026!'

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data: unknown
  try { data = text ? JSON.parse(text) : null } catch { data = text?.slice(0, 300) }
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  const login = await api('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })
  const token = (login.data as { token: string }).token

  const menu = await api('/menu/items', { token }) as { data: Array<{ id: string; available: boolean }> }
  const menuItemId = menu.data.find(m => m.available)!.id

  const customer = await api('/customers', {
    token,
    method: 'POST',
    body: { firstName: 'Loyalty', lastName: 'Test', email: `loy-${Date.now()}@test.com` },
  })
  const customerId = (customer.data as { id: string }).id

  const order = await api('/orders', {
    token,
    method: 'POST',
    body: { type: 'TAKEAWAY', customerId, items: [{ menuItemId, quantity: 1 }] },
  })
  const orderId = (order.data as { id: string }).id
  await api(`/orders/${orderId}/status`, { token, method: 'PATCH', body: { status: 'READY' } })

  const cash = await api('/cash/session/current', { token })
  if (!(cash.data as { id?: string } | null)?.id) {
    await api('/cash/session/open', { token, method: 'POST', body: { openingBalance: 100 } })
  }

  console.log('Finalize CASH + applyLoyaltyDiscount:true ...')
  const fin = await api('/payments/finalize', {
    token,
    method: 'POST',
    body: { orderId, paymentMethod: 'CASH', tipAmount: 0, applyLoyaltyDiscount: true },
  })
  console.log('Status:', fin.status)
  console.log('Body:', typeof fin.data === 'string' ? fin.data : JSON.stringify(fin.data).slice(0, 500))

  const health = await api('/health')
  console.log('Health after:', health.status)
}

main().catch(e => { console.error(e); process.exit(1) })
