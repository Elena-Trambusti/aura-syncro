import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { formatTime, cn } from '../../lib/utils'
import { useRealtimeQuery } from '../../hooks/useRealtimeInvalidation'
import { useRole } from '../../hooks/useRole'
import {
  Plus, Users, Phone, Clock, Bell, CheckCircle2, XCircle, Loader2, ListOrdered,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { formatApiError, resolveToastApiError } from '@/lib/formatApiError'
import { useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import {
  AuraDialog,
  AuraDialogBody,
  AuraDialogFooter,
  AuraDialogHeader,
} from '@/components/ui/AuraDialog'

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
    <AuraDialog onClose={onCancel} maxWidth="md" hideClose skipBuiltInA11y>
      <AuraDialogHeader
        onClose={onCancel}
        title={t('waitlist.addGuest')}
        description={t('waitlist.addGuestHint', { defaultValue: 'Aggiungi un ospite alla lista d\'attesa' })}
      />
      <AuraDialogBody>
        <label className="block text-sm font-medium text-pietra">
          {t('waitlist.guestName')}
          <input
            value={form.guestName}
            onChange={e => update('guestName', e.target.value)}
            className="saas-input mt-1 w-full py-2.5 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-pietra">
            {t('common.phone')}
            <input
              value={form.guestPhone}
              onChange={e => update('guestPhone', e.target.value)}
              className="saas-input mt-1 w-full py-2.5 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-pietra">
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
        <label className="block text-sm font-medium text-pietra">
          {t('waitlist.requestedTime')}
          <input
            type="datetime-local"
            value={form.requestedDate}
            onChange={e => update('requestedDate', e.target.value)}
            className="saas-input mt-1 w-full py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-pietra">
          {t('common.email')}
          <input
            type="email"
            value={form.guestEmail}
            onChange={e => update('guestEmail', e.target.value)}
            className="saas-input mt-1 w-full py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-pietra">
          {t('waitlist.notes')}
          <textarea
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            rows={2}
            className="saas-input mt-1 w-full resize-none py-2.5 text-sm"
          />
        </label>
      </AuraDialogBody>
      <AuraDialogFooter className="flex gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-medium text-fumo">
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => onSave({
            ...form,
            requestedDate: new Date(form.requestedDate).toISOString(),
          })}
          disabled={!form.guestName || !form.guestPhone}
          className="flex-1 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-navy hover:bg-aura-gold-light disabled:opacity-60"
        >
          {t('waitlist.addToList')}
        </button>
      </AuraDialogFooter>
    </AuraDialog>
  )
}

interface WaitlistPanelProps {
  selectedDate: string
}

export default function WaitlistPanel({ selectedDate }: WaitlistPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const canManage = can('reservations.manage')
  const [showForm, setShowForm] = useState(false)

  useRealtimeQuery(['waitlist:created', 'waitlist:updated', 'waitlist:deleted'], 'waitlist')

  const { data: entries = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: tq(tk, 'waitlist', selectedDate),
    queryFn: () => api.get(`/waitlist?date=${selectedDate}`).then(r => r.data),
  })

  const createEntry = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/waitlist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'waitlist') })
      setShowForm(false)
      toast.success(t('waitlist.added'))
    },
    onError: (err: unknown) => toast.error(resolveToastApiError(t, err, 'waitlist.addError')),
  })

  const notifyGuest = useMutation({
    mutationFn: (id: string) => api.patch(`/waitlist/${id}/notify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'waitlist') })
      toast.success(t('waitlist.notified'))
    },
    onError: (err: unknown) => toast.error(resolveToastApiError(t, err, 'waitlist.notifyError')),
  })

  const confirmGuest = useMutation({
    mutationFn: (id: string) => api.patch(`/waitlist/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'waitlist') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'reservations') })
      toast.success(t('waitlist.confirmed'))
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error((err as { translatedMessage?: string }).translatedMessage ?? formatApiError(t, err, 'waitlist.confirmError'))
    },
  })

  const cancelEntry = useMutation({
    mutationFn: (id: string) => api.patch(`/waitlist/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'waitlist') })
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
        <p className="text-sm text-fumo">
          {t('waitlist.subtitle', { count: entries.length })}
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-aura-gold px-4 py-2 text-sm font-semibold text-white hover:bg-aura-gold-light"
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
        <div className="flex flex-col items-center rounded-xl border border-dashed border-white/[0.08] bg-navy-surface/50 py-14 text-fumo">
          <ListOrdered className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">{t('waitlist.empty')}</p>
          <p className="mt-1 text-xs text-fumo">{t('waitlist.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={entry.id} className="flex items-center gap-4 rounded-xl premium-card p-4 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-aura-gold/10 text-aura-gold">
                <span className="text-lg font-bold">#{index + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-pietra">{entry.guestName}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                    {t('waitlist.statusWaiting')}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-fumo">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{entry.covers}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTime(entry.requestedDate)}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{entry.guestPhone}</span>
                  <span className={cn('text-xs', index === 0 ? 'font-medium text-emerald-400' : 'text-fumo')}>
                    {waitingMinutes(entry.createdAt)}
                  </span>
                </div>
                {entry.notes && <p className="mt-1 text-xs italic text-fumo">&ldquo;{entry.notes}&rdquo;</p>}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => notifyGuest.mutate(entry.id)}
                    className="rounded-lg p-2 text-blue-400 hover:bg-blue-500/10"
                    title={t('waitlist.notify')}
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmGuest.mutate(entry.id)}
                    className="rounded-lg p-2 text-emerald-400 hover:bg-emerald-500/10"
                    title={t('waitlist.confirm')}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelEntry.mutate(entry.id)}
                    className="rounded-lg p-2 text-fumo hover:bg-red-500/10 hover:text-red-400"
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
