/** Account demo live (prospect sandbox). */
export function isDemoUserEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  if (normalized === 'admin@demo.it') return true
  if (/^admin@demo-[\w-]+\.com$/.test(normalized)) return true
  if (/^staff\d+@demo-[\w-]+\.demo$/.test(normalized)) return true
  if (normalized === 'demo@aurasyncro.it') return true
  return false
}

/** API consentite in scrittura durante la demo (solo status/claim tavoli, non create/delete/layout). */
const DEMO_TABLE_WRITE_OK = [
  /^\/api\/tables\/[^/]+\/status$/,
  /^\/api\/tables\/[^/]+\/claim$/,
  /^\/api\/tables\/[^/]+\/release$/,
  /^\/api\/tables\/[^/]+\/transfer$/,
]

export function normalizeApiPath(path: string): string {
  const clean = path.split('?')[0]
  if (clean.startsWith('/api')) return clean
  return clean.startsWith('/') ? `/api${clean}` : `/api/${clean}`
}

export function isDemoWritePathAllowed(apiPath: string, method: string): boolean {
  const verb = method.toUpperCase()
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true
  const path = normalizeApiPath(apiPath)
  if (verb === 'DELETE') return false
  if (!path.startsWith('/api/tables')) return false
  // Niente create tavoli / floor layout in demo.
  if (path === '/api/tables' || path.includes('floor-layout') || path.includes('/areas')) {
    return false
  }
  return DEMO_TABLE_WRITE_OK.some(re => re.test(path)) || verb === 'PATCH'
}
