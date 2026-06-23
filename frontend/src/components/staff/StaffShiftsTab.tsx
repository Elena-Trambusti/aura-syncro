import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { getRoleLabel, cn } from '../../lib/utils'
import { useRealtimeQuery } from '../../hooks/useRealtimeInvalidation'
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Clock, Trash2, LogIn, LogOut, X, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'

interface StaffMember {
  id: string
  name: string
  role: string
  active?: boolean
}

interface Shift {
  id: string
  userId: string
  date: string
  startTime: string
  endTime: string
  role?: string
  notes?: string
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ABSENT'
  clockIn?: string
  clockOut?: string
  user: { id: string; name: string; role: string }
}

const STATUS_STYLE: Record<Shift['status'], string> = {
  SCHEDULED: 'bg-navy-surface text-fumo',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  ABSENT: 'bg-red-100 text-red-400',
}

/** Lunedì come primo giorno della settimana (IT/EU). */
function getWeekStart(date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface StaffShiftsTabProps {
  onGoToTeam?: () => void
}

export default function StaffShiftsTab({ onGoToTeam }: StaffShiftsTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    userId: '',
    date: toDateInput(new Date()),
    startTime: '18:00',
    endTime: '23:00',
    notes: '',
  })

  useRealtimeQuery(['shift:created', 'shift:updated', 'shift:deleted'], 'staff-shifts')

  const weekKey = toDateInput(weekStart)

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: tq(tk, 'staff-shifts', weekKey),
    queryFn: () => api.get(`/staff/shifts?week=${weekKey}`).then(r => r.data),
  })

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: tq(tk, 'staff'),
    queryFn: () => api.get('/staff').then(r => r.data),
  })

  const assignableStaff = staff.filter(m => m.role !== 'OWNER' && m.active !== false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const weekEnd = addDays(weekStart, 6)
  const weekLabel = `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const day of weekDays) {
      map.set(toDateInput(day), [])
    }
    for (const shift of shifts) {
      const key = toDateInput(new Date(shift.date))
      if (map.has(key)) map.get(key)!.push(shift)
      else {
        const existing = map.get(key) ?? []
        existing.push(shift)
        map.set(key, existing)
      }
    }
    return map
  }, [shifts, weekDays])

  const openFormForDate = (dateStr: string) => {
    setForm(f => ({ ...f, date: dateStr }))
    setShowForm(true)
  }

  const createShift = useMutation({
    mutationFn: () => api.post('/staff/shifts', {
      userId: form.userId,
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'staff-shifts') })
      setShowForm(false)
      toast.success(t('staff.shiftAdded'))
    },
    onError: () => toast.error(t('staff.shiftAddError')),
  })

  const clockShift = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'in' | 'out' }) =>
      api.patch(`/staff/shifts/${id}/clock`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'staff-shifts') })
      toast.success(t('staff.clockUpdated'))
    },
    onError: () => toast.error(t('staff.shiftAddError')),
  })

  const deleteShift = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/shifts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'staff-shifts') })
      toast.success(t('staff.shiftDeleted'))
    },
  })

  const statusLabel = (status: Shift['status']) => t(`staff.shiftStatus.${status.toLowerCase()}`)

  return (
    <div className="space-y-4">
      <div className="rounded-xl premium-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-aura-gold shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-fumo">
            <p className="font-semibold text-pietra">{t('staff.shiftsHowItWorksTitle')}</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>{t('staff.shiftsHowItWorksPlan')}</li>
              <li>{t('staff.shiftsHowItWorksClock')}</li>
              <li>{t('staff.shiftsHowItWorksClick')}</li>
            </ul>
          </div>
        </div>
      </div>

      {assignableStaff.length === 0 && (
        <div className="rounded-xl border border-aura-gold/25 bg-aura-gold/10 p-4 text-sm text-amber-900">
          <p className="font-semibold">{t('staff.shiftsNeedTeamTitle')}</p>
          <p className="mt-1 text-amber-800">{t('staff.shiftsNeedTeamHint')}</p>
          {onGoToTeam && (
            <button
              type="button"
              onClick={onGoToTeam}
              className="mt-3 rounded-lg bg-aura-gold px-4 py-2 text-xs font-semibold text-white hover:bg-aura-gold-light"
            >
              {t('staff.shiftsGoToTeam')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="rounded-lg border border-white/[0.08] p-2 text-fumo hover:bg-white/[0.05]"
            aria-label={t('staff.prevWeek')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-pietra">{weekLabel}</span>
          <button
            type="button"
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="rounded-lg border border-white/[0.08] p-2 text-fumo hover:bg-white/[0.05]"
            aria-label={t('staff.nextWeek')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStart())}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-fumo hover:bg-white/[0.05]"
          >
            {t('staff.thisWeek')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => openFormForDate(toDateInput(new Date()))}
          disabled={assignableStaff.length === 0}
          className="flex items-center gap-2 rounded-xl bg-aura-gold px-4 py-2 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t('staff.addShift')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {weekDays.map(day => {
            const key = toDateInput(day)
            const dayShifts = shiftsByDay.get(key) ?? []
            const isToday = key === toDateInput(new Date())

            return (
              <div
                key={key}
                role="button"
                tabIndex={assignableStaff.length > 0 ? 0 : -1}
                onClick={() => assignableStaff.length > 0 && openFormForDate(key)}
                onKeyDown={e => {
                  if (assignableStaff.length > 0 && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    openFormForDate(key)
                  }
                }}
                className={cn(
                  'rounded-xl border bg-navy-elevated p-4 shadow-sm text-left transition-colors',
                  isToday ? 'border-aura-gold/30 ring-1 ring-amber-200' : 'border-white/[0.08]',
                  assignableStaff.length > 0 && 'hover:border-aura-gold/30 hover:bg-aura-gold/10/30 cursor-pointer',
                  assignableStaff.length === 0 && 'cursor-default',
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-pietra">
                    {day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-aura-gold">
                        {t('staff.today')}
                      </span>
                    )}
                  </p>
                  {assignableStaff.length > 0 && (
                    <span className="rounded-lg border border-white/[0.08] p-1 text-fumo">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                {dayShifts.length === 0 ? (
                  <p className="text-xs text-fumo">{t('staff.noShiftsDayClick')}</p>
                ) : (
                  <ul className="space-y-2" onClick={e => e.stopPropagation()}>
                    {dayShifts.map(shift => (
                      <li
                        key={shift.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-navy-surface/50 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-pietra">{shift.user.name}</p>
                          <p className="flex items-center gap-1 text-xs text-fumo">
                            <Clock className="h-3 w-3" />
                            {shift.startTime} – {shift.endTime}
                            <span className="text-slate-300">·</span>
                            {getRoleLabel(shift.user.role)}
                          </p>
                        </div>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', STATUS_STYLE[shift.status])}>
                          {statusLabel(shift.status)}
                        </span>
                        <div className="flex items-center gap-1">
                          {shift.status === 'SCHEDULED' && (
                            <button
                              type="button"
                              onClick={() => clockShift.mutate({ id: shift.id, action: 'in' })}
                              className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                              title={t('staff.clockIn')}
                            >
                              <LogIn className="h-4 w-4" />
                            </button>
                          )}
                          {shift.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => clockShift.mutate({ id: shift.id, action: 'out' })}
                              className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-500/10"
                              title={t('staff.clockOut')}
                            >
                              <LogOut className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteShift.mutate(shift.id)}
                            className="rounded-lg p-1.5 text-fumo hover:bg-red-500/10 hover:text-red-400"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-md rounded-xl premium-card p-6 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-pietra">{t('staff.addShiftTitle')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-fumo hover:bg-white/[0.05]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formMember')}
                <select
                  value={form.userId}
                  onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                >
                  <option value="">{t('staff.selectMember')}</option>
                  {assignableStaff.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({getRoleLabel(m.role)})</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-pietra">
                {t('common.date')}
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-pietra">
                  {t('staff.startTime')}
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="saas-input mt-1 w-full py-2.5 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-pietra">
                  {t('staff.endTime')}
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="saas-input mt-1 w-full py-2.5 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-pietra">
                {t('staff.formNotes')}
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                  placeholder={t('staff.notesPlaceholder')}
                />
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-fumo">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => createShift.mutate()}
                disabled={createShift.isPending || !form.userId}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light disabled:opacity-60"
              >
                {createShift.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('staff.addShift')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
