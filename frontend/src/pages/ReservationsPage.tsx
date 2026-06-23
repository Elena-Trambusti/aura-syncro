import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatTime, getReservationStatusLabel } from '../lib/utils'
import {
  Plus, Users, Phone, CalendarDays, XCircle, CheckCircle2, Clock, ListOrdered,
  CreditCard, Copy, ExternalLink, Info, UserCheck, LogOut,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useRole } from '../hooks/useRole'
import WaitlistPanel from '../components/reservations/WaitlistPanel'
import AssignTableModal from '../components/reservations/AssignTableModal'
import { cn } from '../lib/utils'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { useRealtimeReservations } from '../hooks/useRealtimeInvalidation'
import QueryErrorBanner from '../components/QueryErrorBanner'

type ReservationTab = 'bookings' | 'waitlist'

interface Reservation {
  id: string; guestName: string; guestPhone: string; guestEmail?: string
  covers: number; date: string; duration: number; status: string
  notes?: string; table?: { number: number }
  customer?: { totalVisits: number }
  depositPaid?: boolean
  depositRequired?: boolean
}

interface RestaurantProfile {
  settings?: {
    noShowDepositRequired?: boolean
    depositAmount?: number
  } | null
}

function ReservationForm({ onSave, onCancel }: { onSave: (data: Record<string, string | number>) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [form, setForm] = useState({
    guestName: '', guestPhone: '', guestEmail: '',
    covers: 2, date: tomorrow.toISOString().slice(0, 16),
    duration: 90, notes: '',
  })
  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-5">{t('reservations.formTitle')}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('reservations.formGuestName')}</label>
              <input value={form.guestName} onChange={e => update('guestName', e.target.value)}
                className="saas-input w-full py-2.5"
                placeholder={t('reservations.formGuestNamePlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('reservations.formPhone')}</label>
              <input value={form.guestPhone} onChange={e => update('guestPhone', e.target.value)}
                className="saas-input w-full py-2.5"
                placeholder={t('reservations.formPhonePlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('reservations.formCovers')}</label>
              <input type="number" min={1} max={20} value={form.covers} onChange={e => update('covers', parseInt(e.target.value))}
                className="saas-input w-full py-2.5" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('reservations.formDateTime')}</label>
              <input type="datetime-local" value={form.date} onChange={e => update('date', e.target.value)}
                className="saas-input w-full py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.email')}</label>
              <input type="email" value={form.guestEmail} onChange={e => update('guestEmail', e.target.value)}
                className="saas-input w-full py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('reservations.formDuration')}</label>
              <select value={form.duration} onChange={e => update('duration', parseInt(e.target.value))}
                className="saas-input w-full py-2.5">
                <option value={60}>{t('reservations.formDuration1h')}</option>
                <option value={90}>{t('reservations.formDuration1h30')}</option>
                <option value={120}>{t('reservations.formDuration2h')}</option>
                <option value={150}>{t('reservations.formDuration2h30')}</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('waitlist.notes')}</label>
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
                className="saas-input w-full py-2.5 resize-none"
                rows={2} placeholder={t('reservations.formNotesPlaceholder')} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-medium">{t('common.cancel')}</button>
          <button onClick={() => onSave({ ...form, date: new Date(form.date).toISOString() })}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold">
            {t('reservations.formConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function requiresDepositFromSettings(settings: RestaurantProfile['settings']): boolean {
  return Boolean(settings?.noShowDepositRequired && (settings?.depositAmount ?? 0) > 0)
}

function localDateStr(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ReservationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { restaurant } = useAuth()
  const { can } = useRole()
  const canManageReservations = can('reservations.manage')
  useRealtimeReservations()
  const [activeTab, setActiveTab] = useState<ReservationTab>('bookings')
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(localDateStr())
  const [assigningReservation, setAssigningReservation] = useState<Reservation | null>(null)

  const bookingUrl = restaurant?.slug
    ? `${window.location.origin}/prenota/${restaurant.slug}`
    : ''

  const { data: restaurantProfile } = useQuery<RestaurantProfile>({
    queryKey: tq(tk, 'restaurant'),
    queryFn: () => api.get('/restaurant').then(r => r.data),
  })

  const depositPolicyActive = requiresDepositFromSettings(restaurantProfile?.settings)

  const { data: reservations = [], isError: reservationsError } = useQuery<Reservation[]>({
    queryKey: tq(tk, 'reservations', selectedDate),
    queryFn: () => api.get(`/reservations?date=${selectedDate}`).then(r => r.data),
  })

  const createReservation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/reservations', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'reservations') })
      setShowForm(false)
      if (res.data?.depositRequired) {
        toast.success(t('reservations.depositRequiredNotice'))
      } else {
        toast.success(t('reservations.confirmed'))
      }
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/reservations/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'reservations') })
      queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
    },
  })

  const copyDepositLink = useMutation({
    mutationFn: (reservationId: string) =>
      api.post(`/reservations/${reservationId}/deposit-checkout`),
    onSuccess: async (res) => {
      const url = res.data?.checkoutUrl
      if (!url) {
        toast.error(t('reservations.depositPayError'))
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success(t('reservations.depositLinkCopied'))
    },
    onError: () => toast.error(t('reservations.depositPayError')),
  })

  const copyBookingLink = () => {
    if (!bookingUrl) return
    navigator.clipboard.writeText(bookingUrl)
    toast.success(t('common.linkCopied'))
  }

  const totalCovers = reservations.filter(r => !['CANCELLED', 'NO_SHOW'].includes(r.status)).reduce((s, r) => s + r.covers, 0)

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    SEATED: 'bg-emerald-100 text-emerald-800',
    COMPLETED: 'bg-slate-100 text-slate-500',
    CANCELLED: 'bg-red-100 text-red-600',
    NO_SHOW: 'bg-gray-100 text-gray-500',
  }

  const needsDeposit = (res: Reservation) =>
    (res.depositRequired ?? depositPolicyActive) && !res.depositPaid && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(res.status)

  const activeReservations = reservations.filter(r => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(r.status))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="aura-page-title">{t('reservations.title')}</h1>
          <p className="aura-page-subtitle">{t('reservations.subtitle', { count: reservations.length, covers: totalCovers })}</p>
        </div>
        {canManageReservations && activeTab === 'bookings' && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" />
            {t('reservations.newReservation')}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{t('reservations.howItWorksTitle')}</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>{t('reservations.howItWorksBookings')}</li>
              <li>{t('reservations.howItWorksWaitlist')}</li>
              <li>{t('reservations.howItWorksPublic')}</li>
            </ul>
            <p className="text-xs text-slate-500">{t('reservations.workflowHint')}</p>
          </div>
        </div>
        {bookingUrl && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">{t('reservations.publicBookingLink')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 break-all">{bookingUrl}</code>
              <button type="button" onClick={copyBookingLink}
                className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label={t('common.copyLink')}>
                <Copy className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => window.open(bookingUrl, '_blank')}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50">
                <ExternalLink className="w-3.5 h-3.5" />
                {t('reservations.openPublicBooking')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
            activeTab === 'bookings'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {t('reservations.tabBookings')}
          {activeReservations.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{activeReservations.length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('waitlist')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
            activeTab === 'waitlist'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          <ListOrdered className="h-4 w-4" />
          {t('reservations.tabWaitlist')}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="saas-input rounded-xl px-4 py-2 text-slate-900" />
        <div className="flex gap-2">
          {[-1, 0, 1].map(offset => {
            const dateStr = localDateStr(offset)
            const labels = [t('common.yesterday', 'Ieri'), t('common.today', 'Oggi'), t('common.tomorrow', 'Domani')]
            return (
              <button key={offset} onClick={() => setSelectedDate(dateStr)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${selectedDate === dateStr ? 'bg-amber-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                {labels[offset + 1]}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'waitlist' ? (
        <WaitlistPanel selectedDate={selectedDate} />
      ) : reservationsError ? (
        <QueryErrorBanner />
      ) : (
      <>
      <div className="space-y-3">
        {reservations.map(res => (
          <div key={res.id} className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-4 ${['CANCELLED', 'NO_SHOW'].includes(res.status) ? 'opacity-60' : ''}`}>
            <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-bold text-amber-700">{formatTime(res.date)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-slate-900">{res.guestName}</p>
                {res.customer && res.customer.totalVisits > 3 && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">VIP</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[res.status]}`}>
                  {getReservationStatusLabel(res.status)}
                </span>
                {res.depositPaid && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    {t('reservations.depositPaid')}
                  </span>
                )}
                {needsDeposit(res) && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    {t('reservations.depositRequired')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{res.covers} {t('reservations.guests')}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{res.duration} {t('common.minutes')}</span>
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{res.guestPhone}</span>
                {res.table && <span className="text-amber-700 font-medium">T{res.table.number}</span>}
              </div>
              {res.notes && <p className="text-xs text-slate-600 mt-1 italic">&quot;{res.notes}&quot;</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {needsDeposit(res) && canManageReservations && (
                <button
                  type="button"
                  onClick={() => copyDepositLink.mutate(res.id)}
                  disabled={copyDepositLink.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold disabled:opacity-50"
                  title={t('reservations.copyDepositLink')}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('reservations.copyDepositLink')}</span>
                </button>
              )}
              {canManageReservations && (res.status === 'PENDING' || (res.status === 'CONFIRMED' && !res.table)) && (
                <button
                  onClick={() => setAssigningReservation(res)}
                  className="flex items-center gap-1 px-2.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                  title={t('reservations.assignTable')}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('reservations.assignTable')}</span>
                </button>
              )}
              {canManageReservations && res.status === 'CONFIRMED' && res.table && (
                <>
                  <button onClick={() => updateStatus.mutate({ id: res.id, status: 'SEATED' })}
                    className="flex items-center gap-1 px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors"
                    title={t('reservations.markSeated')}>
                    <UserCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('reservations.markSeated')}</span>
                  </button>
                  <button onClick={() => updateStatus.mutate({ id: res.id, status: 'NO_SHOW' })}
                    className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
                    title={t('reservations.markNoShow')}>
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              )}
              {canManageReservations && res.status === 'SEATED' && (
                <button onClick={() => updateStatus.mutate({ id: res.id, status: 'COMPLETED' })}
                  className="flex items-center gap-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  title={t('reservations.markCompleted')}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('reservations.markCompleted')}</span>
                </button>
              )}
              {canManageReservations && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(res.status) && (
                <button onClick={() => updateStatus.mutate({ id: res.id, status: 'CANCELLED' })}
                  className="p-2 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition-colors" title={t('common.cancel')}>
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {reservations.length === 0 && (
          <div className="flex flex-col items-center py-16 text-slate-600 rounded-xl border border-dashed border-slate-200 bg-white">
            <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">{t('reservations.noReservations')}</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md text-center">{t('reservations.noReservationsHint')}</p>
          </div>
        )}
      </div>

      {showForm && (
        <ReservationForm
          onSave={data => createReservation.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {assigningReservation && (
        <AssignTableModal
          reservation={assigningReservation}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: tq(tk, 'reservations') })
            queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
            setAssigningReservation(null)
          }}
          onCancel={() => setAssigningReservation(null)}
        />
      )}
      </>
      )}
    </div>
  )
}
