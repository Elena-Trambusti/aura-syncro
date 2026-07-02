import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'

type SetupSlot = { start: string; end: string; available: boolean }

type Props = {
  value: string
  onChange: (isoStart: string) => void
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default function SetupCalendar({ value, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-setup-slots', weekStart.toISOString()],
    queryFn: () =>
      api
        .get<{ slots: SetupSlot[] }>('/restaurant/onboarding/setup-slots', {
          params: { from: weekStart.toISOString(), to: weekEnd.toISOString() },
        })
        .then(r => r.data),
  })

  const slotsByDay = useMemo(() => {
    const map = new Map<string, SetupSlot[]>()
    for (const slot of data?.slots ?? []) {
      const dayKey = new Date(slot.start).toLocaleDateString('sv-SE')
      const list = map.get(dayKey) ?? []
      list.push(slot)
      map.set(dayKey, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.start.localeCompare(b.start))
    }
    return map
  }, [data?.slots])

  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const fmtDay = (d: Date) =>
    d.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setWeekStart(prev => addDays(prev, -7))}
          className="inline-flex items-center gap-2 rounded-lg border border-[#333333] bg-[#111111] px-4 py-2 text-sm text-gray-300 hover:bg-[#222222] hover:text-white transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('onboardingForm.calendar.prevWeek')}
        </button>
        <p className="text-sm font-medium text-white tracking-wide">
          {fmtDay(weekStart)} — {fmtDay(addDays(weekStart, 4))}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart(prev => addDays(prev, 7))}
          className="inline-flex items-center gap-2 rounded-lg border border-[#333333] bg-[#111111] px-4 py-2 text-sm text-gray-300 hover:bg-[#222222] hover:text-white transition-all"
        >
          {t('onboardingForm.calendar.nextWeek')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="mr-3 h-6 w-6 animate-spin text-[#D4AF37]" />
          {t('onboardingForm.calendar.loading')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {days.map(day => {
            const key = day.toLocaleDateString('sv-SE')
            const daySlots = slotsByDay.get(key) ?? []
            return (
              <div key={key} className="rounded-xl border border-[#222222] bg-[#0A0A0A] p-5 shadow-lg">
                <p className="mb-4 text-sm font-bold tracking-wider text-[#D4AF37] uppercase">{fmtDay(day)}</p>
                {daySlots.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">{t('onboardingForm.calendar.noSlots')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map(slot => {
                      const selected = value === slot.start
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => onChange(slot.start)}
                          className={cn(
                            'rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200',
                            !slot.available && 'cursor-not-allowed bg-[#1A1A1A] text-gray-600 line-through',
                            slot.available && !selected && 'border border-[#333333] bg-[#111111] text-gray-300 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5',
                            selected && 'border border-[#D4AF37] bg-gradient-to-r from-[#D4AF37] to-[#AA8A2E] text-black shadow-lg shadow-[#D4AF37]/20',
                          )}
                        >
                          {fmtTime(slot.start)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {value && (
        <p className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-5 py-4 text-sm font-medium text-[#D4AF37] flex items-center justify-center">
          {t('onboardingForm.calendar.selected', {
            datetime: new Date(value).toLocaleString(i18n.language, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </p>
      )}
    </div>
  )
}
