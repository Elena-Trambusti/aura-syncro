/** Data calendario YYYY-MM-DD nel fuso Europe/Rome. */
export function formatRomeDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(date)
}

const formattersCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timeZone: string) {
  let formatter = formattersCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    formattersCache.set(timeZone, formatter)
  }
  return formatter
}

function zonedParts(date: Date, timeZone: string) {
  const parts = getFormatter(timeZone).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  }
}

/** Inizio/fine giornata calendario (YYYY-MM-DD) nel fuso IANA indicato — per filtri DB. */
export function dayBoundsInTimezone(dateStr: string, timeZone = 'Europe/Rome'): { gte: Date; lt: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date: ${dateStr}`)
  }
  const [y, mo, d] = dateStr.split('-').map(Number)
  let lo = Date.UTC(y, mo - 1, d - 1, 0, 0, 0)
  let hi = Date.UTC(y, mo - 1, d + 1, 23, 59, 59)
  const target = `${dateStr}T00:00:00`
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2)
    const p = zonedParts(new Date(mid), timeZone)
    const key = `${p.date}T${p.time}`
    if (key < target) lo = mid + 1
    else hi = mid
  }
  const gte = new Date(hi)
  const nextDay = new Date(Date.UTC(y, mo - 1, d + 1))
  const nextStr = nextDay.toISOString().slice(0, 10)
  let lo2 = gte.getTime()
  let hi2 = lo2 + 48 * 3600_000
  const target2 = `${nextStr}T00:00:00`
  while (hi2 - lo2 > 1000) {
    const mid = Math.floor((lo2 + hi2) / 2)
    const p = zonedParts(new Date(mid), timeZone)
    const key = `${p.date}T${p.time}`
    if (key < target2) lo2 = mid + 1
    else hi2 = mid
  }
  return { gte, lt: new Date(hi2) }
}

/** Converte data+ora locali (YYYY-MM-DD, HH:mm) nel fuso del ristorante → UTC Date. */
export function parseLocalDateTimeInTimezone(
  dateStr: string,
  timeStr: string,
  timeZone = 'Europe/Rome',
): Date {
  const [hh, mm] = timeStr.split(':').map(Number)
  const targetTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
  const { gte, lt } = dayBoundsInTimezone(dateStr, timeZone)
  let lo = gte.getTime()
  let hi = lt.getTime() - 1
  const target = `${dateStr}T${targetTime}`
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2)
    const p = zonedParts(new Date(mid), timeZone)
    const key = `${p.date}T${p.time}`
    if (key < target) lo = mid + 1
    else hi = mid
  }
  return new Date(hi)
}

/** Settimana (7 giorni) a partire da weekStartStr (YYYY-MM-DD) nel fuso indicato. */
export function weekBoundsInTimezone(weekStartStr: string, timeZone = 'Europe/Rome'): { gte: Date; lt: Date } {
  const { gte } = dayBoundsInTimezone(weekStartStr, timeZone)
  const [y, mo, d] = weekStartStr.split('-').map(Number)
  const endDate = new Date(Date.UTC(y, mo - 1, d + 7))
  const endStr = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`
  const { lt } = dayBoundsInTimezone(endStr, timeZone)
  return { gte, lt }
}

/** Ora locale formattata per admin (es. 21/06/2026, 14:30). */
export function formatRomeDateTime(date: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
