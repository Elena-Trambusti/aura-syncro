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
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('onboardingForm.calendar.prevWeek')}
        </button>
        <p className="text-sm font-medium text-slate-700">
          {fmtDay(weekStart)} — {fmtDay(addDays(weekStart, 4))}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart(prev => addDays(prev, 7))}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {t('onboardingForm.calendar.nextWeek')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('onboardingForm.calendar.loading')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {days.map(day => {
            const key = day.toLocaleDateString('sv-SE')
            const daySlots = slotsByDay.get(key) ?? []
            return (
              <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-slate-900">{fmtDay(day)}</p>
                {daySlots.length === 0 ? (
                  <p className="text-xs text-slate-500">{t('onboardingForm.calendar.noSlots')}</p>
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
                            'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                            !slot.available && 'cursor-not-allowed bg-slate-100 text-slate-400 line-through',
                            slot.available && !selected && 'border border-slate-200 bg-slate-50 text-slate-800 hover:border-amber-400 hover:bg-amber-50',
                            selected && 'border border-amber-500 bg-amber-500 text-white shadow-sm',
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
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
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
