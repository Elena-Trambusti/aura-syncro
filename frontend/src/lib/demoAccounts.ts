export interface DemoAccount {
  email: string
  password: string
  slug: string
}

const DEMO_ACCOUNTS = {
  it: {
    email: 'admin@demo-it.com',
    password: 'admin123',
    slug: 'demo-it',
  },
  es: {
    email: 'admin@demo-es.com',
    password: 'admin123',
    slug: 'demo-es',
  },
  'es-can': {
    email: 'admin@demo-es-cn.com',
    password: 'admin123',
    slug: 'demo-es-cn',
  },
} as const satisfies Record<string, DemoAccount>

export type DemoMarket = keyof typeof DEMO_ACCOUNTS

/** Mercato demo da rotta landing (/it, /es, /es-cn) o lingua UI. */
export function resolveDemoMarket(pathname: string, uiLang?: string | null): DemoAccount {
  const path = pathname.toLowerCase()
  if (path === '/es-cn' || path.startsWith('/es-cn/')) return DEMO_ACCOUNTS['es-can']
  if (path === '/es' || path.startsWith('/es/')) return DEMO_ACCOUNTS.es

  const lang = (uiLang || 'it').toLowerCase()
  if (lang === 'es-can' || lang === 'es-cn' || lang.startsWith('es-can')) return DEMO_ACCOUNTS['es-can']
  if (lang.split('-')[0] === 'es') return DEMO_ACCOUNTS.es
  return DEMO_ACCOUNTS.it
}

export function isDemoUserEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (normalized === 'admin@demo.it') return true
  if (/^admin@demo-[\w-]+\.com$/.test(normalized)) return true
  if (/^staff\d+@demo-[\w-]+\.demo$/.test(normalized)) return true
  if (normalized === 'demo@aurasyncro.it') return true
  return false
}
