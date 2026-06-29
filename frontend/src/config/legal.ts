/** Dati legali pubblici Aura Syncro — allineati a contratto v2.0 e fiscal config. */
export const LEGAL_ENTITY = {
  ownerName: 'Elena Trambusti',
  tradeName: 'Aura Syncro',
  vatNumber: '02101860498',
  city: 'Livorno',
  province: 'LI',
  country: 'Italia',
  /** Completare con indirizzo civico se disponibile */
  addressLine: 'Livorno (LI), Italia',
  email: 'elenatrambusti2024@gmail.com',
  /** Inserire PEC quando attiva; fino ad allora contatto via email */
  pec: 'elenatrambusti2024@gmail.com',
  supportHours: 'lun–ven, 9:00–18:00 (CET)',
  competentCourt: 'Foro di Livorno',
  privacyUpdated: '29 giugno 2026',
  termsUpdated: '29 giugno 2026',
} as const

export const LEGAL_SUB_PROCESSORS = [
  { name: 'Vercel Inc.', purpose: 'Hosting frontend e analytics aggregati', region: 'UE/USA (SCC)' },
  { name: 'DigitalOcean LLC', purpose: 'Hosting API backend e database', region: 'UE (FRA1)' },
  { name: 'Stripe, Inc.', purpose: 'Pagamenti e abbonamenti', region: 'UE/USA (SCC)' },
  { name: 'Provider SMTP (Google)', purpose: 'Email transazionali e marketing inviate dai ristoranti', region: 'UE/USA' },
  { name: 'Sentry (Functional Software)', purpose: 'Monitoraggio errori applicativi', region: 'UE/USA (SCC)' },
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
