/** Massimo intervallo ammesso per report fiscale (anti-OOM su tenant ad alto volume). */
export const MAX_FISCAL_RANGE_DAYS = 366

export function fiscalRangeDaySpan(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / 86_400_000) + 1
}

export function isFiscalRangeWithinLimit(start: Date, end: Date): boolean {
  return fiscalRangeDaySpan(start, end) <= MAX_FISCAL_RANGE_DAYS
}
