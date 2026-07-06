import { type CSSProperties, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from '@/lib/toast'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import PublicLanguageSwitcher from '../components/public/PublicLanguageSwitcher'
import AuraIcon from '../components/ui/AuraIcon'
import { AlertCircle, CalendarDays, CheckCircle2, Users, Phone, Mail, User, UtensilsCrossed } from 'lucide-react'

interface BookingInfo {
  restaurant: {
    name: string
    slug: string
    description?: string | null
    phone?: string | null
    logo?: string | null
    coverImage?: string | null
    colorTheme?: string | null
  }
  settings: {
    openTime: string
    closeTime: string
    maxCoversPerSlot: number
    effectiveMaxCoversPerSlot?: number
    reservationSlotMinutes: number
    depositRequired: boolean
    depositAmount: number
    timezone: string
  }
}

function combineDateAndTime(date: string, time: string): { localDate: string; localTime: string } {
  return { localDate: date, localTime: time }
}



export default function PublicReservationPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    covers: '2',
    date: '',
    time: '20:00',
    notes: '',
  })

  const { data, isLoading, error } = useQuery<BookingInfo>({
    queryKey: ['public-booking', slug],
    queryFn: () => api.get(`/public/booking/${slug}`).then(r => r.data),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  })

  const maxCovers = data?.settings.effectiveMaxCoversPerSlot ?? data?.settings.maxCoversPerSlot ?? 20

  const bookMutation = useMutation({
    mutationFn: async () => {
      const covers = Number.parseInt(form.covers, 10)
      if (!Number.isFinite(covers) || covers < 1 || covers > maxCovers) {
        throw new Error(t('publicBooking.coversInvalid', { max: maxCovers }))
      }
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `booking_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      const res = await api.post<{
        reservationId: string
        status: string
        depositRequired: boolean
        checkoutUrl?: string
      }>(`/public/reservations`, {
        slug,
        guestName: form.guestName.trim(),
        guestPhone: form.guestPhone.trim(),
        guestEmail: form.guestEmail.trim() || undefined,
        covers,
        ...combineDateAndTime(form.date, form.time),
        notes: form.notes.trim() || undefined,
      }, { headers: { 'X-Idempotency-Key': idempotencyKey } })
      return res.data
    },
    onSuccess: result => {
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }
      setSubmitted(true)
      toast.success(t('publicBooking.success'))
    },
    onError: (err: unknown) => {
      const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      const localMsg = err instanceof Error ? err.message : undefined
      toast.error(apiMsg ?? localMsg ?? t('publicBooking.error'))
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-navy">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-aura-gold" />
      </div>
    )
  }

  if (error || !data || !slug) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-navy p-6">
        <div className="max-w-sm rounded-2xl border border-white/[0.08] bg-navy-surface p-10 text-center shadow-2xl">
          <AlertCircle className="mx-auto mb-5 h-12 w-12 text-rose-400" />
          <h2 className="text-xl font-bold text-pietra">{t('publicBooking.notFound')}</h2>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[100dvh] items-center justify-center bg-navy p-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-navy-surface p-10 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-aura-gold" />
          <h1 className="text-2xl font-bold text-pietra">{t('publicBooking.successTitle')}</h1>
          <p className="mt-3 text-sm text-fumo leading-relaxed">{t('publicBooking.successDesc')}</p>
          <Link
            to={`/menu/${slug}`}
            className="mt-8 inline-block rounded-xl border border-aura-gold/30 bg-aura-gold/10 px-6 py-3 text-sm font-bold tracking-wider text-aura-gold uppercase transition-colors hover:bg-aura-gold/20"
          >
            {t('publicBooking.viewMenu')}
          </Link>
        </div>
      </div>
    )
  }

  const minDate = new Date().toISOString().split('T')[0]!
  const brandColor = data.restaurant.colorTheme || '#c9a227'
  const heroImage = data.restaurant.coverImage
    || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80"
  const introStyle = {
    '--brand-color': brandColor,
  } as CSSProperties

  return (
    <div 
      className="min-h-[100dvh] text-pietra flex flex-col relative" 
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(3, 7, 18, 0.5) 0%, rgba(3, 7, 18, 0.95) 100%), url('${heroImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        ...introStyle
      }}
    >
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <div className="pointer-events-auto">
          <PublicLanguageSwitcher />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-3 py-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-8 sm:px-6 sm:py-16 sm:pb-0">
        
        <div className="text-center flex flex-col items-center mb-10">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-aura-gold/40 bg-navy-surface/90 shadow-[0_0_40px_rgba(212,175,55,0.3)] backdrop-blur-xl mb-6">
            {data.restaurant.logo ? (
              <img src={data.restaurant.logo} alt={data.restaurant.name} className="h-full w-full object-cover" />
            ) : (
              <AuraIcon icon={UtensilsCrossed} size="hero" weight="display" className="text-aura-gold" />
            )}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-aura-gold mb-3">
            {t('publicBooking.badge')}
          </p>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight text-white drop-shadow-2xl">
            {data.restaurant.name}
          </h1>
        </div>

        <div className="w-full max-w-xl premium-card backdrop-blur-3xl bg-navy/60 p-5 sm:p-12 shadow-[0_0_60px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/[0.1] rounded-3xl sm:rounded-[2rem]">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-aura-gold to-amber-400 opacity-80" />
          
          <p className="text-center text-sm leading-relaxed text-fumo">
            {t('publicBooking.welcome', { name: data.restaurant.name })}
          </p>
          <p className="mt-2 text-center text-[11px] font-medium tracking-widest uppercase text-fumo/70">
            {t('publicBooking.hours', {
              open: data.settings.openTime,
              close: data.settings.closeTime,
            })}
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={e => {
              e.preventDefault()
              bookMutation.mutate()
            }}
          >
            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fumo">
                <User className="h-3.5 w-3.5 text-aura-gold" /> {t('publicBooking.name')}
              </label>
              <input
                required
                minLength={2}
                value={form.guestName}
                onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))}
                className="w-full rounded-xl border border-white/[0.06] bg-navy-elevated/40 px-4 py-3.5 text-sm text-white shadow-inner transition-all hover:border-white/[0.1] focus:border-aura-gold/50 focus:bg-navy-elevated/80 focus:outline-none focus:ring-1 focus:ring-aura-gold/50"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fumo">
                <Phone className="h-3.5 w-3.5 text-aura-gold" /> {t('publicBooking.phone')}
              </label>
              <input
                required
                minLength={6}
                type="tel"
                value={form.guestPhone}
                onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))}
                className="w-full rounded-xl border border-white/[0.06] bg-navy-elevated/40 px-4 py-3.5 text-sm text-white shadow-inner transition-all hover:border-white/[0.1] focus:border-aura-gold/50 focus:bg-navy-elevated/80 focus:outline-none focus:ring-1 focus:ring-aura-gold/50"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fumo">
                <Mail className="h-3.5 w-3.5 text-aura-gold" /> {t('publicBooking.emailOptional')}
              </label>
              <input
                type="email"
                value={form.guestEmail}
                onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))}
                className="w-full rounded-xl border border-white/[0.06] bg-navy-elevated/40 px-4 py-3.5 text-sm text-white shadow-inner transition-all hover:border-white/[0.1] focus:border-aura-gold/50 focus:bg-navy-elevated/80 focus:outline-none focus:ring-1 focus:ring-aura-gold/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fumo">
                  <CalendarDays className="h-3.5 w-3.5 text-aura-gold" /> {t('publicBooking.date')}
                </label>
                <input
                  required
                  type="date"
                  min={minDate}
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-xl border border-white/[0.06] bg-navy-elevated/40 px-4 py-3.5 text-sm text-white shadow-inner transition-all hover:border-white/[0.1] focus:border-aura-gold/50 focus:bg-navy-elevated/80 focus:outline-none focus:ring-1 focus:ring-aura-gold/50 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-fumo">{t('publicBooking.time')}</label>
                <input
                  required
                  type="time"
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full rounded-xl border border-white/[0.06] bg-navy-elevated/40 px-4 py-3.5 text-sm text-white shadow-inner transition-all hover:border-white/[0.1] focus:border-aura-gold/50 focus:bg-navy-elevated/80 focus:outline-none focus:ring-1 focus:ring-aura-gold/50 [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fumo">
                <Users className="h-3.5 w-3.5 text-aura-gold" /> {t('publicBooking.covers')}
              </label>
              <input
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={maxCovers}
                value={form.covers}
                onChange={e => {
                  const raw = e.target.value
                  if (raw === '') {
                    setForm(f => ({ ...f, covers: '' }))
                    return
                  }
                  const digits = raw.replace(/\D/g, '')
                  if (digits === '') {
                    setForm(f => ({ ...f, covers: '' }))
                    return
                  }
                  const n = Number.parseInt(digits, 10)
                  setForm(f => ({
                    ...f,
                    covers: String(Math.min(maxCovers, Math.max(1, n))),
                  }))
                }}
                onBlur={() => {
                  if (form.covers === '' || Number.parseInt(form.covers, 10) < 1) {
                    setForm(f => ({ ...f, covers: '1' }))
                  }
                }}
                className="w-full rounded-xl border border-white/[0.06] bg-navy-elevated/40 px-4 py-3.5 text-sm text-white shadow-inner transition-all hover:border-white/[0.1] focus:border-aura-gold/50 focus:bg-navy-elevated/80 focus:outline-none focus:ring-1 focus:ring-aura-gold/50"
              />
              <p className="mt-2 text-xs text-fumo/50">
                {t('publicBooking.maxCovers', { max: maxCovers })}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-fumo">{t('publicBooking.notes')}</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl border border-white/[0.06] bg-navy-elevated/40 px-4 py-3.5 text-sm text-white shadow-inner transition-all hover:border-white/[0.1] focus:border-aura-gold/50 focus:bg-navy-elevated/80 focus:outline-none focus:ring-1 focus:ring-aura-gold/50 resize-none"
                placeholder={t('publicBooking.notesPlaceholder')}
              />
            </div>

            {data.settings.depositRequired && (
              <div className="rounded-xl border border-aura-gold/20 bg-aura-gold/5 p-4 text-center">
                <p className="text-sm font-medium text-aura-gold">
                  {t('publicBooking.depositNotice', {
                    amount: formatCurrency(data.settings.depositAmount),
                  })}
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={bookMutation.isPending}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-aura-gold to-amber-400 py-4 text-sm font-extrabold uppercase tracking-[0.15em] text-navy shadow-[0_0_30px_rgba(212,175,55,0.25)] transition-all hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100"
              >
                {bookMutation.isPending ? t('common.loading') : t('publicBooking.submit')}
              </button>
            </div>

            <Link
              to={`/menu/${slug}`}
              className="mt-6 block text-center text-xs font-bold uppercase tracking-wider text-fumo hover:text-aura-gold transition-colors"
            >
              {t('publicBooking.viewMenu')}
            </Link>
          </form>

          <footer className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] text-fumo">
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
              <Link to="/informativa-ospiti" className="hover:text-aura-gold underline-offset-2 hover:underline">
                {t('publicBooking.guestPrivacy', { defaultValue: 'Privacy ospiti' })}
              </Link>
              <span aria-hidden>·</span>
              <Link to="/cookie" className="hover:text-aura-gold underline-offset-2 hover:underline">Cookie</Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
