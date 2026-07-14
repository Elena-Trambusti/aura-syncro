/** Dati legali pubblici Aura Syncro — allineati a contratto v2.0 e fiscal config. */

function legalEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

export const LEGAL_VERSIONS = {
  privacy: '2026-07-13',
  terms: '2026-07-13',
  cookie: '2026-07-13',
  dpa: '2026-07-13',
  guestPrivacy: '2026-07-13',
} as const

/** Versione inviata in registrazione (Termini + DPA) */
export const LEGAL_DOCUMENT_VERSION = LEGAL_VERSIONS.terms

export const LEGAL_ENTITY = {
  ownerName: 'Elena Trambusti',
  tradeName: 'Aura Syncro',
  vatNumber: '02101860498',
  /** Via e numero civico — impostare VITE_LEGAL_STREET_ADDRESS su Vercel se disponibile */
  streetAddress: legalEnv('VITE_LEGAL_STREET_ADDRESS'),
  city: 'Livorno',
  province: 'LI',
  zipCode: legalEnv('VITE_LEGAL_ZIP_CODE'),
  country: 'Italia',
  email: 'elenatrambusti2024@gmail.com',
  /** PEC — impostare VITE_LEGAL_PEC su Vercel; se assente si usa solo email */
  pec: legalEnv('VITE_LEGAL_PEC') || null,
  supportHours: 'lun–ven, 9:00–18:00 (CET)',
  competentCourt: 'Foro di Livorno',
  /** Punto di contatto DSA (art. 11) — stesso canale supporto B2B */
  dsaContactEmail: 'elenatrambusti2024@gmail.com',
  privacyUpdated: '13 luglio 2026',
  termsUpdated: '13 luglio 2026',
} as const

/** Indirizzo formattato per informative */
export function formatLegalAddress(): string {
  const { streetAddress, zipCode, city, province, country } = LEGAL_ENTITY
  const parts = [
    streetAddress?.trim(),
    [zipCode, city].filter(Boolean).join(' ').trim(),
    province ? `(${province})` : '',
    country,
  ].filter(Boolean)
  return parts.join(', ').replace(/,\s*\(/, ' (') || `${city} (${province}), ${country}`
}

export const LEGAL_SUB_PROCESSORS = [
  { name: 'Vercel Inc.', purpose: 'Hosting frontend e analytics aggregati (solo con consenso)', region: 'UE/USA (SCC)' },
  { name: 'DigitalOcean LLC', purpose: 'Hosting API backend e database PostgreSQL', region: 'UE (FRA1)' },
  { name: 'Stripe, Inc.', purpose: 'Pagamenti e abbonamenti', region: 'UE/USA (SCC)' },
  { name: 'Provider SMTP (Google)', purpose: 'Email transazionali e marketing inviate dai ristoranti', region: 'UE/USA' },
  { name: 'Sentry (Functional Software)', purpose: 'Monitoraggio errori applicativi (solo con consenso)', region: 'UE/USA (SCC)' },
] as const

export const LEGAL_URLS = {
  privacy: '/privacy',
  terms: '/termini',
  cookie: '/cookie',
  dpa: '/dpa',
  contact: '/contatti',
  guestPrivacy: '/informativa-ospiti',
  garante: 'https://www.garanteprivacy.it',
} as const
