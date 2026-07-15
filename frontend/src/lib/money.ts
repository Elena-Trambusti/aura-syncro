/** Coercion sicura per importi API (Prisma Decimal serializzato come stringa o number). */
export function moneyNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : fallback
  }
  if (typeof value === 'object' && value !== null && 'd' in value && 'e' in value) {
    const d = value as { d: number[]; e: number; s?: number }
    const digits = d.d.join('')
    if (!digits) return fallback
    const sign = d.s === -1 ? -1 : 1
    const n = sign * Number(digits) * 10 ** (d.e - digits.length + 1)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Intero in centesimi — evita drift float nelle somme/split. */
export function toCents(value: unknown): number {
  return Math.round(moneyNumber(value) * 100)
}

export function fromCents(cents: number): number {
  return roundMoney(cents / 100)
}

/**
 * Divide `totalCents` in `parts` quote equalin, ultimo ospite prende il residuale.
 */
export function splitEqualCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return []
  if (parts === 1) return [totalCents]
  const base = Math.floor(totalCents / parts)
  const shares = Array.from({ length: parts - 1 }, () => base)
  shares.push(totalCents - base * (parts - 1))
  return shares
}

export function addMoney(...values: unknown[]): number {
  return roundMoney(values.reduce<number>((sum, v) => sum + moneyNumber(v), 0))
}

export function lineGrossMoney(
  quantity: unknown,
  unitPrice: unknown,
  modifierTotal = 0,
): number {
  return roundMoney(moneyNumber(quantity) * moneyNumber(unitPrice) + moneyNumber(modifierTotal))
}
