import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { getRoleLabel, cn } from '../../lib/utils'
import { useRealtimeQuery } from '../../hooks/useRealtimeInvalidation'
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Clock, Trash2, LogIn, LogOut, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface StaffMember {
  id: string
  name: string
  role: string
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
  SCHEDULED: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  ABSENT: 'bg-red-100 text-red-700',
}

function getWeekStart(date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateInput(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function StaffShiftsTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => getWeekStart())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    userId: '',
    date: toDateInput(new Date()),
    startTime: '09:00',
    endTime: '17:00',
    notes: '',
  })

  useRealtimeQuery(['shift:created', 'shift:updated', 'shift:deleted'], 'staff-shifts')

  const weekIso = weekStart.toISOString()

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['staff-shifts', weekIso],
    queryFn: () => api.get(`/staff/shifts?week=${weekIso}`).then(r => r.data),
  })

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: () => api.get('/staff').then(r => r.data),
  })

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
    }
    return map
  }, [shifts, weekDays])

  const createShift = useMutation({
    mutationFn: () => api.post('/staff/shifts', {
      userId: form.userId,
      date: new Date(`${form.date}T00:00:00`).toISOString(),
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-shifts'] })
      setShowForm(false)
      toast.success(t('staff.shiftAdded'))
    },
    onError: () => toast.error(t('staff.shiftAddError')),
  })

  const clockShift = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'in' | 'out' }) =>
      api.patch(`/staff/shifts/${id}/clock`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-shifts'] })
      toast.success(t('staff.clockUpdated'))
    },
  })

  const deleteShift = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/shifts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-shifts'] })
      toast.success(t('staff.shiftDeleted'))
    },
  })

  const statusLabel = (status: Shift['status']) => t(`staff.shiftStatus.${status.toLowerCase()}`)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label={t('staff.prevWeek')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-800">{weekLabel}</span>
          <button
            type="button"
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label={t('staff.nextWeek')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(getWeekStart())}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {t('staff.thisWeek')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
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
        <div className="grid gap-4 lg:grid-cols-2">
          {weekDays.map(day => {
            const key = toDateInput(day)
            const dayShifts = shiftsByDay.get(key) ?? []
            const isToday = key === toDateInput(new Date())

            return (
              <div
                key={key}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm',
                  isToday ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200',
                )}
              >
                <p className="mb-3 text-sm font-semibold text-slate-900">
                  {day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                  {isToday && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      {t('staff.today')}
                    </span>
                  )}
                </p>

                {dayShifts.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('staff.noShiftsDay')}</p>
                ) : (
                  <ul className="space-y-2">
                    {dayShifts.map(shift => (
                      <li
                        key={shift.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{shift.user.name}</p>
                          <p className="flex items-center gap-1 text-xs text-slate-500">
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
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                              title={t('staff.clockIn')}
                            >
                              <LogIn className="h-4 w-4" />
                            </button>
                          )}
                          {shift.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => clockShift.mutate({ id: shift.id, action: 'out' })}
                              className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                              title={t('staff.clockOut')}
                            >
                              <LogOut className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteShift.mutate(shift.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t('staff.addShiftTitle')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-900">
                {t('staff.formMember')}
                <select
                  value={form.userId}
                  onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                >
                  <option value="">{t('staff.selectMember')}</option>
                  {staff.filter(m => m.role !== 'OWNER').map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({getRoleLabel(m.role)})</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-900">
                {t('common.date')}
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="saas-input mt-1 w-full py-2.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-900">
                  {t('staff.startTime')}
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="saas-input mt-1 w-full py-2.5 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-900">
                  {t('staff.endTime')}
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="saas-input mt-1 w-full py-2.5 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-900">
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
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => createShift.mutate()}
                disabled={createShift.isPending || !form.userId}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
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
