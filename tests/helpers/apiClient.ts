export type AuthSession = {
  token: string
  restaurantId: string
  userId: string
}

export function apiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? process.env.E2E_API_URL ?? 'http://localhost:3001').replace(/\/$/, '')
}

export async function loginApi(
  email: string,
  password: string,
  restaurantSlug?: string,
): Promise<AuthSession> {
  const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email,
      password,
      ...(restaurantSlug ? { restaurantSlug } : {}),
    }),
  })

  const body = await res.json().catch(() => ({})) as {
    token?: string
    user?: { id: string }
    restaurant?: { id: string }
    error?: string
  }

  if (!res.ok || !body.token || !body.restaurant?.id) {
    throw new Error(`Login API fallito (${res.status}): ${body.error ?? 'token mancante'}`)
  }

  return {
    token: body.token,
    restaurantId: body.restaurant.id,
    userId: body.user!.id,
  }
}

export async function apiFetch(
  path: string,
  session: AuthSession,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  headers.set('X-Restaurant-Id', session.restaurantId)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers })
}
