/** Versioni documenti legali — allineate a frontend/src/config/legal.ts */

export const LEGAL_VERSIONS = {
  privacy: '2026-07-13',
  terms: '2026-07-13',
  cookie: '2026-07-13',
  dpa: '2026-07-13',
  guestPrivacy: '2026-07-13',
} as const

export const CURRENT_LEGAL_VERSION = LEGAL_VERSIONS.terms

/** Versioni ancora accettabili in registrazione (grace period) */
export const ACCEPTED_LEGAL_VERSIONS: readonly string[] = [
  CURRENT_LEGAL_VERSION,
  '2026-06-29',
]

export function isAcceptedLegalVersion(version: string): boolean {
  return ACCEPTED_LEGAL_VERSIONS.includes(version)
}
