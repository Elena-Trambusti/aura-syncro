/** Oggetti email automazioni marketing — per defaultLocale tenant (non lingua UI staff). */

type AutomationType = 'BIRTHDAY' | 'WIN_BACK' | 'VIP_THANKS' | 'REQUEST_REVIEW'

const SUBJECTS: Record<string, Record<AutomationType, string>> = {
  'it-IT': {
    BIRTHDAY: 'Auguri da {{restaurantName}}',
    WIN_BACK: 'Ci manchi!',
    VIP_THANKS: 'Grazie da {{restaurantName}}',
    REQUEST_REVIEW: 'Come sei stato da {{restaurantName}}?',
  },
  'en-GB': {
    BIRTHDAY: 'Happy birthday from {{restaurantName}}',
    WIN_BACK: 'We miss you!',
    VIP_THANKS: 'Thank you from {{restaurantName}}',
    REQUEST_REVIEW: 'How was your visit at {{restaurantName}}?',
  },
  'en-US': {
    BIRTHDAY: 'Happy birthday from {{restaurantName}}',
    WIN_BACK: 'We miss you!',
    VIP_THANKS: 'Thank you from {{restaurantName}}',
    REQUEST_REVIEW: 'How was your visit at {{restaurantName}}?',
  },
  'es-ES': {
    BIRTHDAY: 'Feliz cumpleaños de {{restaurantName}}',
    WIN_BACK: '¡Te echamos de menos!',
    VIP_THANKS: 'Gracias de {{restaurantName}}',
    REQUEST_REVIEW: '¿Cómo fue tu visita en {{restaurantName}}?',
  },
  'fr-FR': {
    BIRTHDAY: 'Joyeux anniversaire de {{restaurantName}}',
    WIN_BACK: 'Vous nous manquez !',
    VIP_THANKS: 'Merci de la part de {{restaurantName}}',
    REQUEST_REVIEW: "Comment s'est passée votre visite chez {{restaurantName}} ?",
  },
  'de-DE': {
    BIRTHDAY: 'Alles Gute zum Geburtstag von {{restaurantName}}',
    WIN_BACK: 'Wir vermissen Sie!',
    VIP_THANKS: 'Danke von {{restaurantName}}',
    REQUEST_REVIEW: 'Wie war Ihr Besuch bei {{restaurantName}}?',
  },
}

function normalizeLocale(locale: string | null | undefined): string {
  if (!locale) return 'it-IT'
  if (SUBJECTS[locale]) return locale
  const base = locale.split('-')[0]
  const match = Object.keys(SUBJECTS).find(k => k.startsWith(`${base}-`))
  return match ?? 'it-IT'
}

export function automationEmailSubject(
  type: AutomationType,
  locale: string | null | undefined,
  vars: { restaurantName: string },
): string {
  const key = normalizeLocale(locale)
  const template = SUBJECTS[key][type]
  return template.replace(/\{\{restaurantName\}\}/g, vars.restaurantName || '')
}
