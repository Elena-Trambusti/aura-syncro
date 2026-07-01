import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatTime, getReservationStatusLabel, toDateInputInTimezone, dateInputOffsetInTimezone } from '../lib/utils'
import {
  Plus, Users, Phone, CalendarDays, XCircle, CheckCircle2, ListOrdered,
  CreditCard, Copy, ExternalLink, UserCheck, LogOut, Link2, ChevronDown,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { useRole } from '../hooks/useRole'
import WaitlistPanel from '../components/reservations/WaitlistPanel'
import AssignTableModal from '../components/reservations/AssignTableModal'
import ReservationsHelpTooltip from '../components/reservations/ReservationsHelpTooltip'
import { cn } from '../lib/utils'
import { ui } from '../lib/ui'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import { useRealtimeReservations } from '../hooks/useRealtimeInvalidation'
import { formatApiError } from '../lib/formatApiError'
import QueryErrorBanner from '../components/QueryErrorBanner'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import EmptyState from '../components/ui/EmptyState'
import GlassModal from '../components/ui/GlassModal'
import { AuraTabs, AuraTabsList, AuraTabsTrigger } from '../components/ui/AuraTabs'
import { isVipCustomer } from '../lib/customerTags'

type ReservationTab = 'bookings' | 'waitlist'

interface Reservation {
  id: string; guestName: string; guestPhone: string; guestEmail?: string
  covers: number; date: string; duration: number; status: string
  notes?: string; table?: { number: number }
  customer?: { totalVisits: number; totalSpent?: number; tags?: string[] }
  depositPaid?: boolean
  depositRequired?: boolean
  depositStripeSessionId?: string | null
  depositAmountPaid?: number | null
}

interface RestaurantProfile {
  settings?: {
    noShowDepositRequired?: boolean
    depositAmount?: number
    effectiveMaxCoversPerSlot?: number
    maxCoversPerSlot?: number
  } | null
}

function ReservationForm({
  maxCovers,
  onSave,
  onCancel,
}: {
  maxCovers: number
  onSave: (data: Record<string, string | number>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [form, setForm] = useState({
    guestName: '', guestPhone: '', guestEmail: '',
    covers: 2, date: tomorrow.toISOString().slice(0, 16),
    notes: '',
  })
  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  return (
    <GlassModal onClose={onCancel} maxWidth="md">
      <h3 className={ui.modalTitle}>{t('reservations.formTitle')}</h3>
      <div className="space-y-4">
          <div>
            <label className={ui.label}>{t('reservations.formGuestName')}</label>
            <input
              value={form.guestName}
              onChange={e => update('guestName', e.target.value)}
              className={ui.input}
              placeholder={t('reservations.formGuestNamePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ui.label}>{t('reservations.formPhone')}</label>
              <input
                value={form.guestPhone}
                onChange={e => update('guestPhone', e.target.value)}
                className={ui.input}
                placeholder={t('reservations.formPhonePlaceholder')}
              />
            </div>
            <div>
              <label className={ui.label}>{t('reservations.formCovers')}</label>
              <input
                type="number"
                min={1}
                max={maxCovers}
                value={form.covers}
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  update('covers', Number.isNaN(n) ? 1 : Math.min(maxCovers, Math.max(1, n)))
                }}
                className={ui.input}
              />
            </div>
          </div>
          <div>
            <label className={ui.label}>{t('reservations.formDateTime')}</label>
            <input
              type="datetime-local"
              value={form.date}
              onChange={e => update('date', e.target.value)}
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label}>{t('common.email')}</label>
            <input
              type="email"
              value={form.guestEmail}
              onChange={e => update('guestEmail', e.target.value)}
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label}>{t('waitlist.notes')}</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              className={ui.textarea}
              rows={2}
              placeholder={t('reservations.formNotesPlaceholder')}
            />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium', ui.chipInactive)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              const name = form.guestName.trim()
              const phone = form.guestPhone.trim()
              const covers = typeof form.covers === 'number' && !Number.isNaN(form.covers) ? form.covers : 0
              if (name.length < 2) {
                toast.error(t('reservations.validationName', { defaultValue: 'Inserisci il nome dell\'ospite' }))
                return
              }
              if (phone.length < 6) {
                toast.error(t('reservations.validationPhone', { defaultValue: 'Inserisci un numero di telefono valido' }))
                return
              }
              if (covers < 1) {
                toast.error(t('reservations.validationCovers', { defaultValue: 'Inserisci un numero valido di coperti' }))
                return
              }
              onSave({ ...form, guestName: name, guestPhone: phone, covers, date: new Date(form.date).toISOString() })
            }}
            className="flex-1 rounded-xl bg-aura-gold py-2.5 text-sm font-semibold text-navy hover:bg-aura-gold-light"
          >
            {t('reservations.formConfirm')}
          </button>
        </div>
    </GlassModal>
  )
}

function requiresDepositFromSettings(settings: RestaurantProfile['settings']): boolean {
  return Boolean(settings?.noShowDepositRequired && (settings?.depositAmount ?? 0) > 0)
}

function localDateStr(timeZone: string, offsetDays = 0): string {
  return dateInputOffsetInTimezone(timeZone, offsetDays)
}

function isArchivedStatus(status: string): boolean {
  return ['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(status)
}

const STATUS_ACCENT: Record<string, string> = {
  PENDING: 'border-l-amber-400',
  CONFIRMED: 'border-l-blue-500',
  SEATED: 'border-l-emerald-500',
  COMPLETED: 'border-l-slate-300',
  CANCELLED: 'border-l-red-300',
  NO_SHOW: 'border-l-slate-300',
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-aura-gold/10 text-amber-800 border-aura-gold/25',
  CONFIRMED: 'bg-blue-500/10 text-blue-800 border-blue-500/25',
  SEATED: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/25',
  COMPLETED: 'bg-navy-surface/50 text-fumo border-white/[0.08]',
  CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/25',
  NO_SHOW: 'bg-navy-surface/50 text-fumo border-white/[0.08]',
}

export default function ReservationsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  const { restaurant } = useAuth()
  const tenantTz = restaurant?.timezone ?? 'Europe/Rome'
  const { can, canAccessAdminNav } = useRole()
  const canManageReservations = can('reservations.manage')
  useRealtimeReservations()
  const [activeTab, setActiveTab] = useState<ReservationTab>('bookings')
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => toDateInputInTimezone(tenantTz))
  const [assigningReservation, setAssigningReservation] = useState<Reservation | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const bookingUrl = restaurant?.slug
    ? `${window.location.origin}/prenota/${restaurant.slug}`
    : ''

  const { data: restaurantProfile } = useQuery<RestaurantProfile>({
    queryKey: tq(tk, 'restaurant'),
    queryFn: () => api.get('/restaurant').then(r => r.data),
    enabled: canAccessAdminNav(),
  })

  const depositPolicyActive = requiresDepositFromSettings(restaurantProfile?.settings)
  const maxCoversPerSlot =
    restaurantProfile?.settings?.effectiveMaxCoversPerSlot
    ?? restaurantProfile?.settings?.maxCoversPerSlot
    ?? 20

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

  const chargeNoShow = useMutation({
    mutationFn: (reservationId: string) => api.post(`/reservations/${reservationId}/charge-no-show`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tq(tk, 'reservations') })
      toast.success(t('reservations.noShowChargeSuccess'))
    },
    onError: (err: any) => {
      toast.error((err as { translatedMessage?: string }).translatedMessage ?? formatApiError(t, err, 'reservations.noShowChargeError'))
    }
  })

  const copyBookingLink = () => {
    if (!bookingUrl) return
    navigator.clipboard.writeText(bookingUrl)
    toast.success(t('common.linkCopied'))
  }

  const totalCovers = reservations.filter(r => !isArchivedStatus(r.status)).reduce((s, r) => s + r.covers, 0)

  const needsDeposit = (res: Reservation) =>
    (res.depositRequired ?? depositPolicyActive)
    && !res.depositPaid
    && !res.depositStripeSessionId
    && !isArchivedStatus(res.status)

  const hasDepositCardOnFile = (res: Reservation) =>
    Boolean(res.depositStripeSessionId && !res.depositPaid && !res.depositAmountPaid)

  const activeReservations = reservations.filter(r => !isArchivedStatus(r.status))
  const archivedReservations = reservations.filter(r => isArchivedStatus(r.status))
  const displayedReservations = showArchived ? reservations : activeReservations

  const canSeatReservation = (res: Reservation) =>
    res.status === 'PENDING' || res.status === 'CONFIRMED'

  return (
    <ExecutivePageShell className="space-y-4">
      <ExecutivePageHeader
        title={t('reservations.title')}
        subtitle={t('reservations.subtitle', { count: activeReservations.length, covers: totalCovers })}
        meta={(
          <>
            <div className="flex items-center gap-2">
              <ReservationsHelpTooltip />
            </div>
            {bookingUrl && activeTab === 'bookings' && (
              <div className="mt-2 flex max-w-xl items-center gap-1.5 text-xs text-fumo">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-fumo" />
                <span className="truncate">{bookingUrl.replace(/^https?:\/\//, '')}</span>
                <button
                  type="button"
                  onClick={copyBookingLink}
                  className="shrink-0 rounded-md p-1 text-fumo hover:bg-white/[0.05] hover:text-fumo"
                  title={t('common.copyLink')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => window.open(bookingUrl, '_blank')}
                  className="shrink-0 rounded-md p-1 text-fumo hover:bg-white/[0.05] hover:text-fumo"
                  title={t('reservations.openPublicBooking')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
        actions={canManageReservations && activeTab === 'bookings' ? (
          <button onClick={() => setShowForm(true)} className={`flex shrink-0 items-center gap-2 ${ui.btnPrimary} px-4 py-2.5 text-sm`}>
            <Plus className="w-4 h-4" />
            {t('reservations.newReservation')}
          </button>
        ) : undefined}
      />

      <div className={`${ui.card} px-4 py-3`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AuraTabs value={activeTab} onValueChange={v => setActiveTab(v as ReservationTab)}>
            <AuraTabsList>
              <AuraTabsTrigger value="bookings">
                <CalendarDays className="h-4 w-4" />
                {t('reservations.tabBookings')}
                {activeReservations.length > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-semibold">{activeReservations.length}</span>
                )}
              </AuraTabsTrigger>
              <AuraTabsTrigger value="waitlist">
                <ListOrdered className="h-4 w-4" />
                {t('reservations.tabWaitlist')}
              </AuraTabsTrigger>
            </AuraTabsList>
          </AuraTabs>

            <div className={ui.filterRow}>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className={`${ui.input} w-auto rounded-xl py-2`}
              />
              {[-1, 0, 1].map(offset => {
                const dateStr = localDateStr(tenantTz, offset)
                const labels = [t('common.yesterday', 'Ieri'), t('common.today', 'Oggi'), t('common.tomorrow', 'Domani')]
                return (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      selectedDate === dateStr ? ui.tabActive : ui.chipInactive,
                    )}
                  >
                    {labels[offset + 1]}
                  </button>
                )
              })}
            </div>
          </div>
      </div>

      {activeTab === 'waitlist' ? (
        <WaitlistPanel selectedDate={selectedDate} />
      ) : reservationsError ? (
        <QueryErrorBanner />
      ) : (
      <>
      <div className="space-y-2">
        {displayedReservations.map(res => (
          <div
            key={res.id}
            className={cn(
              'rounded-xl border border-white/[0.08] border-l-4 bg-navy-elevated p-4 shadow-sm transition-colors hover:border-white/[0.1]',
              STATUS_ACCENT[res.status] ?? 'border-l-slate-300',
              isArchivedStatus(res.status) && 'opacity-75',
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-navy-surface/50 border border-white/[0.08]">
                  <span className="text-lg font-bold leading-none text-pietra">{formatTime(res.date)}</span>
                  <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-fumo">{res.duration}′</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-pietra">{res.guestName}</p>
                    {res.customer && isVipCustomer(res.customer) && (
                      <span className="rounded-full border border-violet-200 bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-400">{t('crm.filters.vip')}</span>
                    )}
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', STATUS_BADGE[res.status])}>
                      {getReservationStatusLabel(res.status)}
                    </span>
                    {res.depositPaid && (
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        {t('reservations.depositPaid')}
                      </span>
                    )}
                    {needsDeposit(res) && (
                      <span className="rounded-full border border-aura-gold/25 bg-aura-gold/10 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {t('reservations.depositRequired')}
                      </span>
                    )}
                    {hasDepositCardOnFile(res) && (
                      <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">
                        {t('reservations.depositCardSaved')}
                      </span>
                    )}
                    {res.depositAmountPaid && res.depositAmountPaid > 0 && (
                      <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                        {t('reservations.depositPenaltyCollected', { amount: res.depositAmountPaid })}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fumo">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{res.covers} {t('reservations.guests')}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{res.guestPhone}</span>
                    {res.table && (
                      <span className="inline-flex items-center gap-1 font-medium text-aura-gold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        T{res.table.number}
                      </span>
                    )}
                  </div>
                  {res.notes && <p className="mt-1.5 text-sm text-fumo line-clamp-2">{res.notes}</p>}
                </div>
              </div>

              {canManageReservations && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-3 sm:border-t-0 sm:pt-0 sm:pl-2">
                  {res.status === 'NO_SHOW' && res.depositStripeSessionId && !res.depositAmountPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('reservations.chargeNoShowConfirm'))) {
                          chargeNoShow.mutate(res.id)
                        }
                      }}
                      disabled={chargeNoShow.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      title={t('reservations.chargeNoShow')}
                    >
                      <CreditCard className="h-4 w-4" />
                      <span className="hidden md:inline">{t('reservations.chargeNoShow')}</span>
                    </button>
                  )}

                  {!isArchivedStatus(res.status) && (
                    <>
                      {needsDeposit(res) && (
                        <button
                          type="button"
                          onClick={() => copyDepositLink.mutate(res.id)}
                          disabled={copyDepositLink.isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-aura-gold/25 bg-aura-gold/10 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          title={t('reservations.copyDepositLink')}
                        >
                          <CreditCard className="h-4 w-4" />
                          <span className="hidden md:inline">{t('reservations.copyDepositLink')}</span>
                        </button>
                      )}
                      {canSeatReservation(res) && (
                        <button
                          type="button"
                          onClick={() => setAssigningReservation(res)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                          title={t('reservations.assignTable')}
                        >
                          <UserCheck className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('reservations.assignTable')}</span>
                        </button>
                      )}
                      {res.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={() => updateStatus.mutate({ id: res.id, status: 'NO_SHOW' })}
                          className="rounded-lg p-2 text-fumo hover:bg-white/[0.05] hover:text-fumo"
                          title={t('reservations.markNoShow')}
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      )}
                      {res.status === 'SEATED' && (
                        <button
                          type="button"
                          onClick={() => updateStatus.mutate({ id: res.id, status: 'COMPLETED' })}
                          className="inline-flex items-center gap-1 rounded-lg premium-card px-2.5 py-2 text-xs font-semibold text-fumo hover:bg-white/[0.05]"
                          title={t('reservations.markCompleted')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('reservations.markCompleted')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => updateStatus.mutate({ id: res.id, status: 'CANCELLED' })}
                        className="rounded-lg p-2 text-fumo hover:bg-red-500/10 hover:text-red-400"
                        title={t('common.cancel')}
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {displayedReservations.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title={showArchived || archivedReservations.length === 0
              ? t('reservations.noReservations')
              : t('reservations.activeEmptyTitle')}
            description={showArchived || archivedReservations.length === 0
              ? t('reservations.noReservationsHint')
              : t('reservations.activeEmptyHint')}
          />
        )}
      </div>

      {archivedReservations.length > 0 && activeTab === 'bookings' && (
        <button
          type="button"
          onClick={() => setShowArchived(v => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-xl premium-card px-4 py-2.5 text-sm font-medium text-fumo hover:bg-white/[0.05]"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', showArchived && 'rotate-180')} />
          {showArchived
            ? t('reservations.hideArchived')
            : t('reservations.showArchived', { count: archivedReservations.length })}
        </button>
      )}

      {showForm && (
        <ReservationForm
          maxCovers={maxCoversPerSlot}
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
    </ExecutivePageShell>
  )
}
