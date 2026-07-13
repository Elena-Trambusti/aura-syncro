/** Campi da filtrare nei log/monitoraggio (Sentry, ecc.). */
export const SENSITIVE_BODY_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'resetToken',
  'authorization',
  'secret',
  'apiKey',
] as const

export function redactSensitiveFields(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const out = { ...(data as Record<string, unknown>) }
  for (const key of SENSITIVE_BODY_FIELDS) {
    if (key in out) out[key] = '[FILTERED]'
  }
  return out
}
