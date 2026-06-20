/** Parse YYYY-MM-DD as local calendar date (avoids UTC shift from `new Date('YYYY-MM-DD')`). */
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

/** Same filter used by /reports/pl and /reports/fiscal — paidAt within [start, end]. */
export function paidOrdersWhere(restaurantId: string, start: Date, end: Date) {
  return {
    restaurantId,
    status: 'PAID' as const,
    paidAt: { gte: start, lte: end },
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

/** Date used for fiscal/report filtering: paidAt when set, otherwise createdAt. */
export function effectivePaidAt(paidAt: Date | null, createdAt: Date): Date {
  return paidAt ?? createdAt
}
