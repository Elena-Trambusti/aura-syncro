import { Link } from 'react-router-dom'
import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  UtensilsCrossed, CalendarClock, ChefHat, ArrowRight, Loader2, Users,
} from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'
import { api } from '../../lib/api'
import { cn, formatTime, toDateInputInTimezone } from '../../lib/utils'
import { useAuth, useTenantQueryKey } from '../../contexts/AuthContext'
import { tq } from '../../lib/queryKeys'
import { useRole } from '../../hooks/useRole'
import { useShowQuerySkeleton } from '../../hooks/useShowQuerySkeleton'
import QueryErrorBanner from '../QueryErrorBanner'
import {
  useRealtimeTables,
  useRealtimeOrders,
  useRealtimeReservations,
} from '../../hooks/useRealtimeInvalidation'

interface FloorTable { status: string }
interface ReservationRow {
  id: string
  guestName: string
  covers: number
  date: string
  status: string
  table?: { number: number } | null
}
interface ActiveOrder {
  id: string
  status: string
  table?: { number: number } | null
}

function localToday(timeZone: string): string {
  return toDateInputInTimezone(timeZone)
}

const TABLE_STATUS_KEYS: Record<string, string> = {
  FREE: 'tables.free',
  OCCUPIED: 'tables.occupied',
  RESERVED: 'tables.reserved',
  CLEANING: 'tables.cleaning',
}

export default function LiveCommandCenter() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const tenantTz = restaurant?.timezone ?? 'Europe/Rome'
  const tk = useTenantQueryKey()
  const { can } = useRole()
  const tenantReady = Boolean(restaurant?.id)

  const canTables = can('tables.read')
  const canReservations = can('reservations.read')
  const canOrders = can('orders.read')
  const canKitchen = can('orders.kitchen_status') || can('orders.items')

  useRealtimeTables()
  useRealtimeOrders()
  useRealtimeReservations()

  const { data: tables = [], isLoading: loadingTables, isError: tablesError } = useQuery<FloorTable[]>({
    queryKey: tq(tk, 'tables'),
    queryFn: () => api.get('/tables').then(r => r.data),
    enabled: tenantReady && canTables,
    refetchInterval: 60_000,
  })

  const { data: reservations = [], isLoading: loadingRes, isError: reservationsError } = useQuery<ReservationRow[]>({
    queryKey: tq(tk, 'reservations', 'today'),
    queryFn: () => api.get(`/reservations?date=${localToday(tenantTz)}`).then(r => r.data),
    enabled: tenantReady && canReservations,
    refetchInterval: 60_000,
  })

  const { data: activeOrders = [], isLoading: loadingOrders, isError: ordersError } = useQuery<ActiveOrder[]>({
    queryKey: tq(tk, 'orders', 'active'),
    queryFn: () => api.get('/orders/active').then(r => r.data),
    enabled: tenantReady && canOrders,
    refetchInterval: 30_000,
  })

  const showTablesSkeleton = useShowQuerySkeleton(loadingTables, tables.length > 0)
  const showResSkeleton = useShowQuerySkeleton(loadingRes, reservations.length > 0)
  const showOrdersSkeleton = useShowQuerySkeleton(loadingOrders, activeOrders.length > 0)

  const tableStats = useMemo(() => {
    const counts = { FREE: 0, OCCUPIED: 0, RESERVED: 0, CLEANING: 0 }
    for (const table of tables) {
      const key = table.status as keyof typeof counts
      if (key in counts) counts[key] += 1
    }
    return counts
  }, [tables])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return reservations
      .filter(r => !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(r.status))
      .filter(r => new Date(r.date).getTime() >= now - 30 * 60_000)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4)
  }, [reservations])

  const kitchenStats = useMemo(() => {
    let pending = 0
    let preparing = 0
    for (const order of activeOrders) {
      if (order.status === 'PENDING') pending += 1
      else if (['PREPARING', 'READY'].includes(order.status)) preparing += 1
    }
    return { pending, preparing, total: activeOrders.length }
  }, [activeOrders])

  const modules = useMemo(() => [
    canTables && {
      key: 'tables',
      title: t('dashboard.tableStatus'),
      icon: UtensilsCrossed,
      tone: 'gold' as const,
      loading: showTablesSkeleton,
      href: '/tavoli',
      cta: t('dashboard.viewFloor'),
      content: (
        <div className="aura-table-status-grid">
          {(['FREE', 'OCCUPIED', 'RESERVED', 'CLEANING'] as const).map(status => (
            <div key={status} className={cn('aura-table-status-cell', `aura-table-status-cell--${status.toLowerCase()}`)}>
              <span className="aura-table-status-cell__value">{tableStats[status]}</span>
              <span className="aura-table-status-cell__label">{t(TABLE_STATUS_KEYS[status])}</span>
            </div>
          ))}
        </div>
      ),
    },
    canReservations && {
      key: 'reservations',
      title: t('dashboard.upcomingReservations'),
      icon: CalendarClock,
      tone: 'blue' as const,
      loading: showResSkeleton,
      href: '/prenotazioni',
      cta: t('dashboard.viewReservations'),
      content: upcoming.length === 0 ? (
        <p className="py-6 text-center text-sm text-fumo">{t('dashboard.noUpcomingReservations')}</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map(r => (
            <li key={r.id} className="aura-upcoming-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pietra">{r.guestName}</p>
                <p className="text-xs text-fumo">
                  {formatTime(r.date)}
                  {r.table?.number != null && ` · T${r.table.number}`}
                </p>
              </div>
              <span className="aura-upcoming-covers">
                <Users className="h-3 w-3" aria-hidden />
                {r.covers}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    canKitchen && {
      key: 'kitchen',
      title: t('dashboard.kitchenQueue'),
      icon: ChefHat,
      tone: 'emerald' as const,
      loading: showOrdersSkeleton,
      href: '/cucina',
      cta: t('dashboard.openKitchen'),
      content: (
        <div className="grid grid-cols-3 gap-2">
          <div className="aura-kitchen-stat">
            <span className="aura-kitchen-stat__value">{kitchenStats.pending}</span>
            <span className="aura-kitchen-stat__label">{t('dashboard.kitchenPending')}</span>
          </div>
          <div className="aura-kitchen-stat aura-kitchen-stat--active">
            <span className="aura-kitchen-stat__value">{kitchenStats.preparing}</span>
            <span className="aura-kitchen-stat__label">{t('dashboard.kitchenPreparing')}</span>
          </div>
          <div className="aura-kitchen-stat">
            <span className="aura-kitchen-stat__value">{kitchenStats.total}</span>
            <span className="aura-kitchen-stat__label">{t('dashboard.activeOrders')}</span>
          </div>
        </div>
      ),
    },
  ].filter(Boolean) as Array<{
    key: string
    title: string
    icon: typeof UtensilsCrossed
    tone: 'gold' | 'blue' | 'emerald'
    loading: boolean
    href: string
    cta: string
    external?: boolean
    content: ReactNode
  }>, [
    canTables,
    canReservations,
    canOrders,
    canKitchen,
    t,
    tableStats,
    upcoming,
    kitchenStats,
    showTablesSkeleton,
    showResSkeleton,
    showOrdersSkeleton,
  ])

  if (modules.length === 0) return null

  return (
    <section className="aura-command-center" aria-label={t('dashboard.liveCommandTitle')}>
      <div className="aura-command-center__header">
        <div>
          <p className="aura-brand-eyebrow">{t('dashboard.liveCommandTitle')}</p>
          <h2 className="premium-section-title mt-1">{t('dashboard.liveCommandSubtitle')}</h2>
        </div>
        <span className="aura-live-pill">
          <span className="aura-live-pill__dot" aria-hidden />
          {t('dashboard.liveSync')}
        </span>
      </div>

      {(tablesError || reservationsError || ordersError) && (
        <QueryErrorBanner message={t('dashboard.liveCommandError', { defaultValue: 'Impossibile aggiornare i dati live. Riprovo automaticamente…' })} />
      )}

      <div className={cn('aura-command-center__grid', modules.length === 2 && 'aura-command-center__grid--2')}>
        {modules.map(mod => {
          const Icon = mod.icon

          return (
            <div key={mod.key} className={cn('aura-command-module', `aura-command-module--${mod.tone}`)}>
              <div className="aura-command-module__head">
                <div className={cn('aura-command-module__icon', `aura-command-module__icon--${mod.tone}`)}>
                  <AuraIcon icon={Icon} size="md" />
                </div>
                <h3 className="aura-command-module__title">{mod.title}</h3>
              </div>

              <div className="aura-command-module__body">
                {mod.loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-aura-gold/70" />
                  </div>
                ) : (
                  mod.content
                )}
              </div>

              {mod.external ? (
                <a
                  href={mod.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aura-command-module__cta group"
                >
                  {mod.cta}
                  <AuraIcon icon={ArrowRight} size="sm" className="transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : (
                <Link to={mod.href} className="aura-command-module__cta group">
                  {mod.cta}
                  <AuraIcon icon={ArrowRight} size="sm" className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
