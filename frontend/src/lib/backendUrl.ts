/** Backend DigitalOcean — usato in produzione se VITE_API_URL non è nel build. */
export const PRODUCTION_BACKEND_URL = 'https://aura-syncro-s98ae.ondigitalocean.app'

const PRODUCTION_HOSTS = new Set(['aurasyncro.com', 'www.aurasyncro.com'])

/** URL base del backend (senza /api). In produzione usa same-origin (/api proxy Vercel → DO). */
export function resolveBackendUrl(): string | undefined {
  if (typeof window !== 'undefined' && PRODUCTION_HOSTS.has(window.location.hostname)) {
    return undefined
  }

  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl?.trim()) {
    return envUrl.trim().replace(/\/$/, '')
  }

  return undefined
}

/** Base URL API (con /api). In dev locale preferisce il proxy Vite (/api) per evitare CORS. */
export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const isLocalDev = host === 'localhost' || host === '127.0.0.1'
    if (isLocalDev && import.meta.env.DEV) {
      return '/api'
    }
  }

  const backend = resolveBackendUrl()
  if (backend) return `${backend}/api`
  return '/api'
}
