/** Origini CORS consentite (FRONTEND_URL può elencarne più di una, separate da virgola). */
export function getAllowedOrigins(): string[] {
  const defaults = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'https://aurasyncro.com',
    'https://www.aurasyncro.com',
  ]
  const fromEnv = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
  return [...new Set([...defaults, ...fromEnv])]
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true
  const allowed = getAllowedOrigins()
  if (allowed.includes(origin)) return true
  // Dev locale: Vite può usare porte diverse se 5173 è occupata
  if (/^http:\/\/localhost:\d+$/i.test(origin)) return true
  if (/^http:\/\/127\.0\.0\.1:\d+$/i.test(origin)) return true
  // Preview deploy Vercel: https://aura-syncro-xxx.vercel.app
  if (/^https:\/\/aura-syncro[a-z0-9-]*\.vercel\.app$/i.test(origin)) return true
  return false
}
