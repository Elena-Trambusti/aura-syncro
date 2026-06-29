import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChefHat, Clock, CheckCircle2, Flame, ExternalLink, Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getSocket } from '../lib/socket'
import QueryErrorBanner from '../components/QueryErrorBanner'
import { useKitchenOrders } from '../hooks/useKitchenOrders'
import { useSocketStatus } from '../hooks/useSocketStatus'
import { Wifi, WifiOff } from 'lucide-react'
import {
  type KitchenOrder,
  type KitchenOrderItem,
  ITEM_STATUS_COLORS,
  KITCHEN_HIDDEN_ITEM_STATUSES,
  nextItemStatus,
  kitchenColumnForOrder,
  orderNeedsKitchenAttention,
} from '../lib/kitchenOrders'

function useElapsedMinutes(createdAt: string) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const calc = () => setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
    calc()
    const id = setInterval(calc, 30_000)
    return () => clearInterval(id)
  }, [createdAt])
  return elapsed
}

const KitchenLiveClock = memo(function KitchenLiveClock() {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith('es-cn') ? 'es' : i18n.language
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="shrink-0 text-right">
      <p className="font-mono text-xl font-bold text-white sm:text-2xl">
        {time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-[10px] text-stone-500 sm:text-xs">
        {time.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
      </p>
    </div>
  )
})

type ItemHandlers = {
  onItemStatusChange: (orderId: string, itemId: string, status: string, units?: number) => void
  isItemBusy: (orderId: string, itemId: string) => boolean
}

const KitchenOrderItemRow = memo(function KitchenOrderItemRow({
  orderId,
  item,
  onItemStatusChange,
  isItemBusy,
}: { orderId: string; item: KitchenOrderItem } & ItemHandlers) {
  const { t } = useTranslation()
  const busy = isItemBusy(orderId, item.id)
  const canAdvance = item.status === 'PENDING' || item.status === 'PREPARING'

  const advance = () => {
    const next = nextItemStatus(item.status)
    if (next) onItemStatusChange(orderId, item.id, next)
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl p-2.5 transition-colors ${
        item.status === 'READY' ? 'bg-emerald-900/40' : 'bg-white/10'
      } ${busy ? 'opacity-70' : ''}`}
    >
      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${ITEM_STATUS_COLORS[item.status] || 'bg-slate-400'}`} />
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600 text-sm font-bold text-white">
        {item.quantity}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-lg font-semibold ${item.status === 'READY' ? 'text-emerald-400 line-through' : 'text-white'}`}>
          {item.menuItem.name}
        </p>
        {item.notes && <p className="mt-1 text-sm font-medium text-yellow-400">⚠ {item.notes}</p>}
        {item.quantity > 1 && item.status === 'PREPARING' && (
          <p className="mt-0.5 text-[10px] text-stone-400">
            {t('kitchen.partialReadyHint', { defaultValue: 'Usa +1 per segnare una porzione pronta' })}
          </p>
        )}
      </div>
      {item.menuItem.preparationTime ? (
        <span className="text-xs text-stone-500">{item.menuItem.preparationTime}m</span>
      ) : null}
      {canAdvance && (
        <div className="flex shrink-0 items-center gap-1">
          {item.status === 'PREPARING' && item.quantity > 1 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onItemStatusChange(orderId, item.id, 'READY', 1)}
              className="flex h-8 items-center gap-1 rounded-lg bg-emerald-700 px-2 text-[10px] font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              title={t('kitchen.markOneReady', { defaultValue: 'Segna 1 porzione pronta' })}
            >
              <Plus className="h-3 w-3" />
              1
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={advance}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            title={t('kitchen.advanceStatus', { defaultValue: 'Avanza stato' })}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  )
}, (prev, next) =>
  prev.orderId === next.orderId &&
  prev.item.id === next.item.id &&
  prev.item.status === next.item.status &&
  prev.item.quantity === next.item.quantity &&
  prev.item.notes === next.item.notes &&
  prev.item.menuItem.name === next.item.menuItem.name &&
  prev.onItemStatusChange === next.onItemStatusChange &&
  prev.isItemBusy(prev.orderId, prev.item.id) === next.isItemBusy(next.orderId, next.item.id),
)

type OrderCardProps = {
  order: KitchenOrder
  isReadyColumn?: boolean
  isOrderBusy: boolean
  onItemStatusChange: ItemHandlers['onItemStatusChange']
  isItemBusy: ItemHandlers['isItemBusy']
  onOrderReady: (orderId: string) => void
  onDismiss: (orderId: string) => void
}

const KitchenOrderCard = memo(function KitchenOrderCard({
  order,
  isReadyColumn,
  isOrderBusy,
  onItemStatusChange,
  isItemBusy,
  onOrderReady,
  onDismiss,
}: OrderCardProps) {
  const { t } = useTranslation()
  const elapsed = useElapsedMinutes(order.createdAt)
  const isUrgent = elapsed >= 15
  const visibleItems = order.items.filter(i => !KITCHEN_HIDDEN_ITEM_STATUSES.has(i.status))
  const pendingItems = visibleItems.filter(i => i.status !== 'READY')
  const allReady = visibleItems.length > 0 && visibleItems.every(i => i.status === 'READY')

  if (visibleItems.length === 0) return null

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border-2 transition-colors ${
        isUrgent ? 'border-red-500 shadow-lg shadow-red-200' :
        order.status === 'PREPARING' ? 'border-orange-400' : 'border-slate-700'
      } bg-[#12151C]/60 backdrop-blur-md`}
    >
      <div
        className={`flex items-center justify-between px-4 py-3 ${
          isUrgent ? 'bg-red-600' : order.status === 'PREPARING' ? 'bg-amber-600' : 'bg-white/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-white">
            {order.table ? `T${order.table.number}` : order.type === 'TAKEAWAY' ? '🥡' : '🛵'}
          </span>
          <div>
            <span className="text-xs font-medium text-white/80">
              {order.type === 'DINE_IN'
                ? t('kitchen.typeDineIn')
                : order.type === 'TAKEAWAY'
                  ? t('kitchen.typeTakeaway')
                  : t('kitchen.typeDelivery')}
            </span>
            <p className="text-xs text-white/60">#{order.id.slice(-4).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUrgent && <Flame className="h-5 w-5 animate-pulse text-white" />}
          <div className={`flex items-center gap-1 text-sm font-bold ${isUrgent ? 'text-white' : 'text-white/90'}`}>
            <Clock className="h-4 w-4" />
            {elapsed}m
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2 p-3">
        {visibleItems.map(item => (
          <KitchenOrderItemRow
            key={item.id}
            orderId={order.id}
            item={item}
            onItemStatusChange={onItemStatusChange}
            isItemBusy={isItemBusy}
          />
        ))}
        {order.notes && (
          <div className="mt-2 rounded-lg border border-yellow-700/40 bg-yellow-900/30 p-2">
            <p className="text-xs text-yellow-400">📝 {order.notes}</p>
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        {allReady || isReadyColumn ? (
          <button
            type="button"
            disabled={isOrderBusy}
            onClick={() => onDismiss(order.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isOrderBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('kitchen.dismissServed', { defaultValue: 'Consegnato — rimuovi' })}
          </button>
        ) : (
          <button
            type="button"
            disabled={isOrderBusy}
            onClick={() => onOrderReady(order.id)}
            className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-navy transition-colors hover:bg-aura-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('kitchen.markAllReady', { defaultValue: 'Segna tutto pronto' })}
          </button>
        )}
        <p className="mt-1 text-center text-xs text-stone-400">
          {pendingItems.length} {t('kitchen.ofTotal', { defaultValue: 'di' })} {visibleItems.length}{' '}
          {t('kitchen.toPrepare', { defaultValue: 'da preparare' })}
        </p>
      </div>
    </div>
  )
}, (prev, next) => {
  if (prev.isReadyColumn !== next.isReadyColumn) return false
  if (prev.isOrderBusy !== next.isOrderBusy) return false
  if (prev.onItemStatusChange !== next.onItemStatusChange) return false
  if (prev.isItemBusy !== next.isItemBusy) return false
  if (prev.onOrderReady !== next.onOrderReady) return false
  if (prev.onDismiss !== next.onDismiss) return false

  const a = prev.order
  const b = next.order
  if (a.id !== b.id || a.status !== b.status || a.createdAt !== b.createdAt) return false
  if (a.type !== b.type || a.notes !== b.notes) return false
  if ((a.table?.number ?? null) !== (b.table?.number ?? null)) return false
  if (a.items.length !== b.items.length) return false

  for (let i = 0; i < a.items.length; i++) {
    const ai = a.items[i]
    const bi = b.items[i]
    if (
      ai.id !== bi.id ||
      ai.status !== bi.status ||
      ai.quantity !== bi.quantity ||
      ai.notes !== bi.notes ||
      ai.menuItem.name !== bi.menuItem.name
    ) {
      return false
    }
  }
  return true
})

type KitchenColumnProps = {
  title: string
  titleClass: string
  icon: React.ReactNode
  orders: KitchenOrder[]
  isReadyColumn?: boolean
  emptyIcon: React.ReactNode
  emptyLabel: string
  onItemStatusChange: ItemHandlers['onItemStatusChange']
  isItemBusy: ItemHandlers['isItemBusy']
  isOrderBusy: (orderId: string) => boolean
  onOrderReady: (orderId: string) => void
  onDismiss: (orderId: string) => void
}

const KitchenColumn = memo(function KitchenColumn({
  title,
  titleClass,
  icon,
  orders,
  isReadyColumn,
  emptyIcon,
  emptyLabel,
  onItemStatusChange,
  isItemBusy,
  isOrderBusy,
  onOrderReady,
  onDismiss,
}: KitchenColumnProps) {
  return (
    <div className="flex min-h-[280px] flex-col lg:min-h-0 lg:overflow-hidden">
      <div className={`border-b border-slate-700 px-4 py-2.5 ${titleClass}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold uppercase tracking-wider">{title}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {orders.map(order => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            isReadyColumn={isReadyColumn}
            isOrderBusy={isOrderBusy(order.id)}
            onItemStatusChange={onItemStatusChange}
            isItemBusy={isItemBusy}
            onOrderReady={onOrderReady}
            onDismiss={onDismiss}
          />
        ))}
        {orders.length === 0 && (
          <div className="flex flex-col items-center py-12 text-stone-300">
            {emptyIcon}
            <p className="text-sm">{emptyLabel}</p>
          </div>
        )}
      </div>
    </div>
  )
})

export default function KitchenDisplayPage() {
  const { t } = useTranslation()
  const [newOrderAlert, setNewOrderAlert] = useState(false)
  const isSocketConnected = useSocketStatus()
  const {
    orders,
    isError,
    handleItemStatusChange,
    handleOrderReady,
    handleDismiss,
    isItemBusy,
    isOrderBusy,
  } = useKitchenOrders()

  useEffect(() => {
    const socket = getSocket()
    let alertTimer: ReturnType<typeof setTimeout> | null = null
    const onNewOrder = (order: KitchenOrder) => {
      if (!orderNeedsKitchenAttention(order)) return
      setNewOrderAlert(true)
      toast(`🔔 ${t('kitchen.newOrder')}`, {
        style: { background: '#c9a227', color: '#fff', fontWeight: 'bold' },
        duration: 4000,
      })
      if (alertTimer) clearTimeout(alertTimer)
      alertTimer = setTimeout(() => setNewOrderAlert(false), 3000)
    }
    socket.on('order:created', onNewOrder)
    return () => {
      socket.off('order:created', onNewOrder)
      if (alertTimer) clearTimeout(alertTimer)
    }
  }, [t])

  const { pending, preparing, ready } = useMemo(() => ({
    pending: orders.filter(o => kitchenColumnForOrder(o) === 'pending'),
    preparing: orders.filter(o => kitchenColumnForOrder(o) === 'preparing'),
    ready: orders.filter(o => kitchenColumnForOrder(o) === 'ready'),
  }), [orders])

  const aggregateItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; tables: Set<string> }>()
    const activeOrders = [...pending, ...preparing]
    
    for (const order of activeOrders) {
      const tableLabel = order.table ? `T${order.table.number}` : (order.type === 'TAKEAWAY' ? '🥡' : '🛵')
      for (const item of order.items) {
        if (item.status === 'PENDING' || item.status === 'PREPARING') {
          const key = item.menuItem.name
          if (!map.has(key)) map.set(key, { name: key, qty: 0, tables: new Set() })
          const group = map.get(key)!
          group.qty += item.quantity
          group.tables.add(tableLabel)
        }
      }
    }
    
    return Array.from(map.values()).sort((a,b) => b.qty - a.qty)
  }, [pending, preparing])

  if (isError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0B0E14] p-6 text-white">
        <QueryErrorBanner message={t('common.loadError')} />
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-navy text-pietra">
      <header
        className={`shrink-0 border-b border-white/[0.08] px-4 py-3 transition-colors sm:px-6 ${
          newOrderAlert ? 'bg-aura-gold/20' : 'bg-navy-elevated/90 backdrop-blur-md'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 gap-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aura-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              <ChefHat className="h-6 w-6 text-navy" />
            </div>
            <div className="min-w-0 flex items-center gap-3">
              <div>
                <h1 className="text-lg font-black text-pietra lux-heading">{t('kitchen.displayTitle')}</h1>
                <p className="text-xs text-fumo">{t('kitchen.subtitle')}</p>
              </div>
              
              {/* Status Badge */}
              {isSocketConnected ? (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 text-xs font-semibold">
                  <Wifi className="w-3 h-3" />
                  {t('kitchen.live')}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/50 border border-red-900/50 text-red-400 text-xs font-semibold animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                  <WifiOff className="w-3 h-3" />
                  {t('kitchen.disconnected')}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4 md:gap-6">
            <div className="flex items-center gap-3 sm:gap-4">
              {[
                { label: t('kitchen.pending'), count: pending.length, color: 'text-aura-gold' },
                { label: t('kitchen.preparing'), count: preparing.length, color: 'text-amber-300' },
                { label: t('kitchen.ready'), count: ready.length, color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-black sm:text-2xl ${s.color}`}>{s.count}</p>
                  <p className="text-[10px] text-stone-500 sm:text-xs">{s.label}</p>
                </div>
              ))}
            </div>

            <KitchenLiveClock />

            <Link
              to="/dashboard"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-stone-500 transition-colors hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('kitchen.backDashboard')}
            </Link>
          </div>
        </div>
      </header>

      {aggregateItems.length > 0 && (
        <div className="shrink-0 border-b border-slate-700 bg-[#12151C]/60 backdrop-blur-md/80 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 shrink-0 text-amber-500 animate-pulse" />
            <span className="shrink-0 text-sm font-bold text-white uppercase tracking-wider">
              {t('kitchen.aggregateTitle')}:
            </span>
            <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {aggregateItems.map(ag => (
                <div key={ag.name} className="flex shrink-0 items-center gap-2 rounded-lg bg-white/10/50 px-3 py-1.5 border border-slate-600">
                  <span className="text-base font-black text-amber-400">{ag.qty}</span>
                  <span className="text-sm font-bold text-white">{ag.name}</span>
                  <span className="text-xs font-medium text-stone-400">
                    ({Array.from(ag.tables).join(', ')})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-700 overflow-y-auto lg:grid-cols-3 lg:divide-x lg:divide-y-0 lg:overflow-hidden">
        <KitchenColumn
          title={`In Attesa (${pending.length})`}
          titleClass="bg-yellow-500/10"
          icon={<div className="h-3 w-3 animate-pulse rounded-full bg-yellow-400" />}
          orders={pending}
          emptyIcon={<ChefHat className="mb-2 h-10 w-10 opacity-40" />}
          emptyLabel="Nessun ordine in attesa"
          onItemStatusChange={handleItemStatusChange}
          isItemBusy={isItemBusy}
          isOrderBusy={isOrderBusy}
          onOrderReady={handleOrderReady}
          onDismiss={handleDismiss}
        />
        <KitchenColumn
          title={`In Preparazione (${preparing.length})`}
          titleClass="bg-amber-600/10"
          icon={<Flame className="h-3.5 w-3.5 text-orange-400" />}
          orders={preparing}
          emptyIcon={<Flame className="mb-2 h-10 w-10 opacity-40" />}
          emptyLabel="Nessun ordine in preparazione"
          onItemStatusChange={handleItemStatusChange}
          isItemBusy={isItemBusy}
          isOrderBusy={isOrderBusy}
          onOrderReady={handleOrderReady}
          onDismiss={handleDismiss}
        />
        <KitchenColumn
          title={`Pronti (${ready.length})`}
          titleClass="bg-emerald-950/10"
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          orders={ready}
          isReadyColumn
          emptyIcon={<CheckCircle2 className="mb-2 h-10 w-10 opacity-40" />}
          emptyLabel="Nessun ordine pronto"
          onItemStatusChange={handleItemStatusChange}
          isItemBusy={isItemBusy}
          isOrderBusy={isOrderBusy}
          onOrderReady={handleOrderReady}
          onDismiss={handleDismiss}
        />
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-700 bg-[#12151C]/60 backdrop-blur-md px-4 py-2 sm:px-6">
        <p className="min-w-0 text-xs text-stone-400">
          {t('kitchen.footerHint', {
            defaultValue: "Tocca ✓ per avanzare · +1 segna una porzione pronta · Consegnato rimuove l'ordine",
          })}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-stone-400 sm:gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            In attesa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            In prep.
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Pronto
          </span>
        </div>
      </footer>
    </div>
  )
}
