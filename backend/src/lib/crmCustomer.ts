import type { CountryCode } from '@prisma/client'

export function buildCustomerName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export function splitCustomerName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export const DEFAULT_AUTOMATION_TEMPLATES: Record<
  'BIRTHDAY' | 'WIN_BACK' | 'VIP_THANKS',
  Record<CountryCode, string>
> = {
  BIRTHDAY: {
    IT: 'Ciao {{firstName}}, il tuo compleanno è tra 3 giorni! Ti aspettiamo con un dessert omaggio dal nostro chef.',
    ES: 'Hola {{firstName}}, ¡tu cumpleaños es en 3 días! Te esperamos con un postre de cortesía de nuestro chef.',
  },
  WIN_BACK: {
    IT: 'Ciao {{firstName}}, ci manchi! Sono passati più di 60 giorni dalla tua ultima visita. Prenota un tavolo e torna a trovarci.',
    ES: 'Hola {{firstName}}, ¡te echamos de menos! Han pasado más de 60 días desde tu última visita. Reserva mesa y vuelve a visitarnos.',
  },
  VIP_THANKS: {
    IT: 'Grazie {{firstName}} per la splendida serata! Abbiamo adorato averti con noi. A presto!',
    ES: '¡Gracias {{firstName}} por una velada maravillosa! Nos encantó tenerte con nosotros. ¡Hasta pronto!',
  },
}

export function defaultTemplate(
  type: keyof typeof DEFAULT_AUTOMATION_TEMPLATES,
  countryCode: CountryCode = 'IT',
): string {
  return DEFAULT_AUTOMATION_TEMPLATES[type][countryCode]
}
