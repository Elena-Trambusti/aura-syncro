import { prisma } from './prisma'

const SLOT_MINUTES = 30
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5] // Lun–Ven
const DEFAULT_START_HOUR = 10
const DEFAULT_END_HOUR = 17
const DEFAULT_TIMEZONE = 'Europe/Rome'

export type SetupSlot = {
  start: string
  end: string
  available: boolean
}

function parseHourEnv(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : fallback
}

function workDaysFromEnv(): number[] {
  const raw = process.env.ONBOARDING_SETUP_WORK_DAYS
  if (!raw) return DEFAULT_WORK_DAYS
  const days = raw.split(',').map(d => Number(d.trim())).filter(d => d >= 0 && d <= 6)
  return days.length > 0 ? days : DEFAULT_WORK_DAYS
}

/** Offset locale semplificato per Europe/Rome (CET/CEST) */
function romeOffsetMinutes(at: Date): number {
  const year = at.getUTCFullYear()
  const lastSundayMarch = new Date(Date.UTC(year, 2, 31))
  lastSundayMarch.setUTCDate(31 - lastSundayMarch.getUTCDay())
  const lastSundayOctober = new Date(Date.UTC(year, 9, 31))
  lastSundayOctober.setUTCDate(31 - lastSundayOctober.getUTCDay())
  const isDst = at >= lastSundayMarch && at < lastSundayOctober
  return isDst ? 120 : 60
}

function zonedParts(date: Date, timeZone: string): { y: number; m: number; d: number; h: number; min: number; wd: number } {
  if (timeZone === 'Europe/Rome') {
    const off = romeOffsetMinutes(date)
    const local = new Date(date.getTime() + off * 60_000)
    return {
      y: local.getUTCFullYear(),
      m: local.getUTCMonth(),
      d: local.getUTCDate(),
      h: local.getUTCHours(),
      min: local.getUTCMinutes(),
      wd: local.getUTCDay(),
    }
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    y: Number(get('year')),
    m: Number(get('month')) - 1,
    d: Number(get('day')),
    h: Number(get('hour')),
    min: Number(get('minute')),
    wd: wdMap[get('weekday')] ?? 0,
  }
}

function makeZonedDate(y: number, m: number, d: number, h: number, min: number, timeZone: string): Date {
  if (timeZone === 'Europe/Rome') {
    const utcGuess = Date.UTC(y, m, d, h, min, 0, 0)
    const off = romeOffsetMinutes(new Date(utcGuess))
    return new Date(utcGuess - off * 60_000)
  }
  const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
  return new Date(iso)
}

export async function listSetupSlots(fromIso: string, toIso: string): Promise<SetupSlot[]> {
  const timeZone = process.env.ONBOARDING_SETUP_TIMEZONE ?? DEFAULT_TIMEZONE
  const workDays = workDaysFromEnv()
  const startHour = parseHourEnv('ONBOARDING_SETUP_START_HOUR', DEFAULT_START_HOUR)
  const endHour = parseHourEnv('ONBOARDING_SETUP_END_HOUR', DEFAULT_END_HOUR)

  const from = new Date(fromIso)
  const to = new Date(toIso)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return []
  }

  const booked = await prisma.setupAppointment.findMany({
    where: {
      status: 'CONFIRMED',
      slotStart: { gte: from, lt: to },
    },
    select: { slotStart: true },
  })
  const bookedSet = new Set(booked.map(b => b.slotStart.toISOString()))

  const slots: SetupSlot[] = []
  const now = new Date()
  const cursor = new Date(from)
  cursor.setUTCHours(0, 0, 0, 0)

  while (cursor < to) {
    const { y, m, d, wd } = zonedParts(cursor, timeZone)
    if (workDays.includes(wd)) {
      for (let h = startHour; h < endHour; h++) {
        for (let min = 0; min < 60; min += SLOT_MINUTES) {
          const start = makeZonedDate(y, m, d, h, min, timeZone)
          if (start < from || start >= to || start <= now) continue
          const end = new Date(start.getTime() + SLOT_MINUTES * 60_000)
          const iso = start.toISOString()
          slots.push({
            start: iso,
            end: end.toISOString(),
            available: !bookedSet.has(iso),
          })
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return slots
}

export async function isSetupSlotAvailable(slotStartIso: string): Promise<boolean> {
  const start = new Date(slotStartIso)
  if (Number.isNaN(start.getTime()) || start <= new Date()) return false
  const end = new Date(start.getTime() + SLOT_MINUTES * 60_000)
  const slots = await listSetupSlots(start.toISOString(), end.toISOString())
  return slots.some(s => s.start === start.toISOString() && s.available)
}
