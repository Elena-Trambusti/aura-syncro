/**
 * Identifica email di account creati per test/sviluppo.
 * Criteri: termina con @example.com oppure contiene "test" (case-insensitive).
 */
export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.endsWith('@example.com')) return true
  if (normalized.includes('test')) return true
  return false
}

/** Filtro Prisma per User / Customer.email */
export const testEmailPrismaFilter = {
  OR: [
    { email: { endsWith: '@example.com', mode: 'insensitive' as const } },
    { email: { contains: 'test', mode: 'insensitive' as const } },
  ],
} as const
