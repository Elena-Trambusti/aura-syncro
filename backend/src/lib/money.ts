import { Prisma } from '@prisma/client'

export type MoneyInput = number | string | Prisma.Decimal

/** Arrotondamento UI / boundary API (2 decimali). */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Persistenza Prisma — sempre 2 decimali HALF_UP. */
export function toMoney(value: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

/** Lettura sicura per calcoli JS e confronti Stripe (centesimi). */
export function moneyNumber(value: MoneyInput | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return roundMoney(value)
  if (typeof value === 'string') return roundMoney(Number(value))
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber()
}

export function isDecimal(value: unknown): value is Prisma.Decimal {
  return Prisma.Decimal.isDecimal(value)
}

/**
 * Serializza Prisma.Decimal → number per JSON API.
 * Non usare JSON.stringify con replacer: Decimal.toJSON() gira prima del replacer
 * e produce stringhe ("8") che il frontend concatena con + invece di sommare.
 */
export function serializeDecimals<T>(value: T): T {
  return deepSerializeMoney(value) as T
}

function deepSerializeMoney(value: unknown): unknown {
  if (value == null) return value
  if (isDecimal(value)) {
    return moneyNumber(value)
  }
  if (value instanceof Date) return value
  if (Array.isArray(value)) {
    return value.map(deepSerializeMoney)
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepSerializeMoney(child)
    }
    return out
  }
  return value
}

/** Campi _sum Prisma aggregate su importi monetari. */
export type MoneyAggSum = {
  revenueAmount?: MoneyInput | null
  subtotal?: MoneyInput | null
  tax?: MoneyInput | null
  tipAmount?: MoneyInput | null
  total?: MoneyInput | null
}

/** Ricavo cibo da aggregate ordini (revenueAmount o subtotal+tax). */
export function sumFoodFromMoneyAgg(agg: { _sum: MoneyAggSum }): number {
  const rev = moneyNumber(agg._sum.revenueAmount)
  if (rev > 0) return rev
  return moneyNumber(agg._sum.subtotal) + moneyNumber(agg._sum.tax)
}
