/** Parse YYYY-MM-DD as local calendar date (avoids UTC shift from `new Date('YYYY-MM-DD')`). */
import { dayBoundsInTimezone } from './romeDate'

export { dayBoundsInTimezone }

export function parseLocalDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

/** Data calendario YYYY-MM-DD nel fuso del tenant (es. Europe/Rome). */
export function calendarDateInTimezone(timeZone: string, ref = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(ref)
}

/** Ora locale (0–23) nel fuso IANA indicato. */
export function hourInTimezone(timeZone: string, ref = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(ref),
  )
}

/** Sposta una data calendario YYYY-MM-DD di N giorni. */
export function shiftCalendarDate(dateStr: string, deltaDays: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

/** Inizio/fine giornata locale per il calendario nel fuso tenant (approssimazione server-local). */
export function dayRangeInTimezone(timeZone: string, ref = new Date()): { start: Date; end: Date } {
  const dateStr = calendarDateInTimezone(timeZone, ref)
  try {
    const { gte, lt } = dayBoundsInTimezone(dateStr, timeZone)
    return { start: gte, end: new Date(lt.getTime() - 1) }
  } catch {
    return { start: startOfLocalDay(ref), end: endOfLocalDay(ref) }
  }
}

export function buildMonthRangeInTimezone(
  year: number,
  month: number,
  timeZone: string,
): { start: Date; end: Date } {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const { gte: start } = dayBoundsInTimezone(monthStart, timeZone)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const { gte: nextStart } = dayBoundsInTimezone(nextMonthStart, timeZone)
  return { start, end: new Date(nextStart.getTime() - 1) }
}

export function startOfLocalMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0)
}

export function endOfLocalMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999)
}

export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export function buildMonthRange(year: number, month: number): { start: Date; end: Date } {
  return { start: startOfLocalMonth(year, month), end: endOfLocalMonth(year, month) }
}

/** Ordini pagati con paidAt nel periodo [start, end]. */
export function paidOrdersWhere(restaurantId: string, start: Date, end: Date) {
  return {
    restaurantId,
    status: 'PAID' as const,
    refundedAt: null,
    paidAt: { gte: start, lte: end },
  }
}

/**
 * Filtro unificato revenue: paidAt nel periodo oppure legacy (paidAt null + createdAt).
 * @param endExclusive — se true, fine periodo esclusiva `[start, end)` (dayBounds `lt`);
 *   se false, fine inclusiva `[start, end]` (endOfLocalDay).
 */
export function paidOrdersInPeriodWhere(
  restaurantId: string,
  start: Date,
  end: Date,
  endExclusive = false,
) {
  const paidAtBound = endExclusive
    ? { gte: start, lt: end }
    : { gte: start, lte: end }
  const createdAtBound = endExclusive
    ? { gte: start, lt: end }
    : { gte: start, lte: end }
  return {
    restaurantId,
    status: 'PAID' as const,
    refundedAt: null,
    OR: [
      { paidAt: paidAtBound },
      { paidAt: null, createdAt: createdAtBound },
    ],
  }
}

/** Legacy orders: paid before paidAt column was populated — match by createdAt. */
export function legacyPaidOrdersWhere(restaurantId: string, start: Date, end: Date) {
  return {
    restaurantId,
    status: 'PAID' as const,
    paidAt: null,
    createdAt: { gte: start, lte: end },
  }
}

export function buildDateRange(query: Record<string, string | undefined>): { start: Date; end: Date } | null {
  // Same params as /reports/pl: ?year=2026&month=6
  if (query.year && query.month && !query.mode) {
    const y = Number(query.year)
    const m = Number(query.month)
    if (m < 1 || m > 12) return null
    return buildMonthRange(y, m)
  }

  const mode = query.mode || 'month'

  if (mode === 'day') {
    if (!query.date) return null
    const day = parseLocalDate(query.date)
    if (!day) return null
    return { start: day, end: endOfLocalDay(day) }
  }

  if (mode === 'month') {
    const y = Number(query.year || new Date().getFullYear())
    const m = Number(query.month || new Date().getMonth() + 1)
    if (m < 1 || m > 12) return null
    return buildMonthRange(y, m)
  }

  if (mode === 'range') {
    if (!query.from || !query.to) return null
    const from = parseLocalDate(query.from)
    const to = parseLocalDate(query.to)
    if (!from || !to) return null
    if (from > to) return null
    return { start: from, end: endOfLocalDay(to) }
  }

  return null
}

/** Like buildDateRange but month/day buckets use tenant timezone calendar dates. */
export function buildDateRangeForTimezone(
  query: Record<string, string | undefined>,
  timeZone: string,
): { start: Date; end: Date } | null {
  const mode = query.mode || 'month'

  if (mode === 'day') {
    if (!query.date) return null
    const { gte, lt } = dayBoundsInTimezone(query.date, timeZone)
    return { start: gte, end: new Date(lt.getTime() - 1) }
  }

  if (mode === 'month') {
    const y = Number(query.year || new Date().getFullYear())
    const m = Number(query.month || new Date().getMonth() + 1)
    if (m < 1 || m > 12) return null
    const monthStr = `${y}-${String(m).padStart(2, '0')}-01`
    const { gte } = dayBoundsInTimezone(monthStr, timeZone)
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const nextStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`
    const { gte: nextStart } = dayBoundsInTimezone(nextStr, timeZone)
    return { start: gte, end: new Date(nextStart.getTime() - 1) }
  }

  if (mode === 'range') {
    if (!query.from || !query.to) return null
    const { gte: start } = dayBoundsInTimezone(query.from, timeZone)
    const { lt } = dayBoundsInTimezone(query.to, timeZone)
    return { start, end: new Date(lt.getTime() - 1) }
  }

  return buildDateRange(query)
}

/** Date used for fiscal/report filtering: paidAt when set, otherwise createdAt. */
export function effectivePaidAt(paidAt: Date | null, createdAt: Date): Date {
  return paidAt ?? createdAt
}
