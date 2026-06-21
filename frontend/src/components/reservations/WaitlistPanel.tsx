import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { formatTime, cn } from '../../lib/utils'
import { useRealtimeQuery } from '../../hooks/useRealtimeInvalidation'
import { useRole } from '../../hooks/useRole'
import {
  Plus, Users, Phone, Clock, Bell, CheckCircle2, XCircle, Loader2, X, ListOrdered,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface WaitlistEntry {
  id: string
  guestName: string
  guestPhone: string
  guestEmail?: string
  covers: number
  requestedDate: string
  notes?: string
  status: string
  notifiedAt?: string
  createdAt: string
}

interface WaitlistFormProps {
  date: string
  onSave: (data: Record<string, string | number>) => void
  onCancel: () => void
}

function WaitlistForm({ date, onSave, onCancel }: WaitlistFormProps) {
  const { t } = useTranslation()
  const defaultTime = `${date}T19:00`
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    covers: 2,
    requestedDate: defaultTime,
    notes: '',
  })
  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{t('waitlist.addGuest')}</h3>
          <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-900">
            {t('waitlist.guestName')}
            <input
              value={form.guestName}
              onChange={e => update('guestName', e.target.value)}
              className="saas-input mt-1 w-full py-2.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-900">
              {t('common.phone')}
              <input
                value={form.guestPhone}
                onChange={e => update('guestPhone', e.target.value)}
                className="saas-input mt-1 w-full py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-900">
              {t('waitlist.covers')}
              <input
                type="number"
                min={1}
                max={20}
                value={form.covers}
                onChange={e => update('covers', parseInt(e.target.value, 10))}
                className="saas-input mt-1 w-full py-2.5 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-900">
            {t('waitlist.requestedTime')}
            <input
              type="datetime-local"
              value={form.requestedDate}
              onChange={e => update('requestedDate', e.target.value)}
              className="saas-input mt-1 w-full py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            {t('common.email')}
            <input
              type="email"
              value={form.guestEmail}
              onChange={e => update('guestEmail', e.target.value)}
              className="saas-input mt-1 w-full py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            {t('waitlist.notes')}
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className="saas-input mt-1 w-full resize-none py-2.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSave({
              ...form,
              requestedDate: new Date(form.requestedDate).toISOString(),
            })}
            disabled={!form.guestName || !form.guestPhone}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {t('waitlist.addToList')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface WaitlistPanelProps {
  selectedDate: string
}

export default function WaitlistPanel({ selectedDate }: WaitlistPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { can } = useRole()
  const canManage = can('reservations.manage')
  const [showForm, setShowForm] = useState(false)

  useRealtimeQuery(['waitlist:created', 'waitlist:updated', 'waitlist:deleted'], 'waitlist')

  const { data: entries = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ['waitlist', selectedDate],
    queryFn: () => api.get(`/waitlist?date=${selectedDate}`).then(r => r.data),
  })

  const createEntry = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/waitlist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
      setShowForm(false)
      toast.success(t('waitlist.added'))
    },
    onError: () => toast.error(t('waitlist.addError')),
  })

  const notifyGuest = useMutation({
    mutationFn: (id: string) => api.patch(`/waitlist/${id}/notify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
      toast.success(t('waitlist.notified'))
    },
  })

  const confirmGuest = useMutation({
    mutationFn: (id: string) => api.patch(`/waitlist/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
      toast.success(t('waitlist.confirmed'))
    },
  })

  const cancelEntry = useMutation({
    mutationFn: (id: string) => api.patch(`/waitlist/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] })
      toast.success(t('waitlist.removed'))
    },
  })

  const waitingMinutes = (createdAt: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
    if (mins < 60) return t('waitlist.waitMinutes', { count: mins })
    return t('waitlist.waitHours', { count: Math.floor(mins / 60) })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {t('waitlist.subtitle', { count: entries.length })}
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            <Plus className="h-4 w-4" />
            {t('waitlist.addGuest')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-slate-500">
          <ListOrdered className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">{t('waitlist.empty')}</p>
          <p className="mt-1 text-xs text-slate-400">{t('waitlist.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={entry.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <span className="text-lg font-bold">#{index + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{entry.guestName}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                    {t('waitlist.statusWaiting')}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{entry.covers}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(entry.requestedDate)}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{entry.guestPhone}</span>
                  <span className={cn('text-xs', index === 0 ? 'font-medium text-emerald-600' : 'text-slate-400')}>
                    {waitingMinutes(entry.createdAt)}
                  </span>
                </div>
                {entry.notes && <p className="mt-1 text-xs italic text-slate-400">&ldquo;{entry.notes}&rdquo;</p>}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => notifyGuest.mutate(entry.id)}
                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                    title={t('waitlist.notify')}
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmGuest.mutate(entry.id)}
                    className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                    title={t('waitlist.confirm')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelEntry.mutate(entry.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title={t('waitlist.cancel')}
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <WaitlistForm
          date={selectedDate}
          onSave={data => createEntry.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
