/** Account demo live (prospect sandbox). */
export function isDemoUserEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  if (normalized === 'admin@demo.it') return true
  if (/^admin@demo-[\w-]+\.com$/.test(normalized)) return true
  if (/^staff\d+@demo-[\w-]+\.demo$/.test(normalized)) return true
  if (normalized === 'demo@aurasyncro.it') return true
  return false
}

/** API consentite in scrittura durante la demo (solo gestione tavoli). */
const DEMO_WRITE_PREFIXES = ['/api/tables'] as const

export function normalizeApiPath(path: string): string {
  const clean = path.split('?')[0]
  if (clean.startsWith('/api')) return clean
  return clean.startsWith('/') ? `/api${clean}` : `/api/${clean}`
}

export function isDemoWritePathAllowed(apiPath: string, method: string): boolean {
  const verb = method.toUpperCase()
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true
  const path = normalizeApiPath(apiPath)
  return DEMO_WRITE_PREFIXES.some(prefix => path.startsWith(prefix))
}
