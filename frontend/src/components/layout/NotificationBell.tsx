import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, X, ShoppingBag, CalendarDays, AlertTriangle, ChefHat } from 'lucide-react'
import { ensureSocketConnected } from '../../lib/socket'
import { formatDateTime } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { toast } from '@/lib/toast'
import AuraIcon from '../ui/AuraIcon'

interface Notification {
  id: string
  type: 'new_order' | 'reservation' | 'low_stock' | 'order_ready'
  message: string
  timestamp: Date
  read: boolean
  orderId?: string
}

const TYPE_CONFIG = {
  new_order: { icon: ShoppingBag, color: 'text-aura-gold', bg: 'bg-aura-gold/10', toast: 'order' as const },
  reservation: { icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-500/10', toast: 'reservation' as const },
  low_stock: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', toast: 'stock' as const },
  order_ready: { icon: ChefHat, color: 'text-emerald-400', bg: 'bg-emerald-500/10', toast: 'ready' as const },
}

const PANEL_WIDTH = 320
const MOBILE_BREAKPOINT = 640
const OVERLAY_Z = 99998
const MENU_Z = 99999

type PanelPosition =
  | { mode: 'desktop'; top: number; right: number }
  | { mode: 'mobile'; top: number }

function getViewportWidth() {
  return window.visualViewport?.width ?? window.innerWidth
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const seenOrdersRef = useRef(new Set<string>())

  const unreadCount = notifications.filter(n => !n.read).length

  const updatePanelPosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const vv = window.visualViewport
    const safeTop = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--safe-top'),
    ) || 0
    const top = Math.max((vv?.offsetTop ?? 0) + rect.bottom + 8, safeTop + 52)

    if (getViewportWidth() < MOBILE_BREAKPOINT) {
      setPanelPos({ mode: 'mobile', top })
      return
    }

    const vw = getViewportWidth()
    const offsetLeft = vv?.offsetLeft ?? 0
    const panelWidth = Math.min(PANEL_WIDTH, vw - 16)
    const rightFromButton = vw + offsetLeft - rect.right
    const right = Math.min(
      Math.max(8, rightFromButton),
      vw + offsetLeft - panelWidth - 8,
    )

    setPanelPos({ mode: 'desktop', top, right })
  }, [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof ensureSocketConnected>> | null = null

    const handleNotification = (data: { type: Notification['type']; message: string; orderId?: string }) => {
      if (data.orderId) {
        if (seenOrdersRef.current.has(data.orderId)) return
        seenOrdersRef.current.add(data.orderId)
      }

      const notif: Notification = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        type: data.type,
        message: data.message,
        timestamp: new Date(),
        read: false,
        orderId: data.orderId,
      }
      setNotifications(prev => [notif, ...prev].slice(0, 50))
      const cfg = TYPE_CONFIG[data.type] || TYPE_CONFIG.new_order
      toast.notify(data.message, cfg.toast)
    }

    void ensureSocketConnected().then((s) => {
      if (cancelled) return
      socket = s
      s.on('notification', handleNotification)
    })

    return () => {
      cancelled = true
      if (!socket) return
      socket.off('notification', handleNotification)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    window.visualViewport?.addEventListener('resize', updatePanelPosition)
    window.visualViewport?.addEventListener('scroll', updatePanelPosition)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
      window.visualViewport?.removeEventListener('resize', updatePanelPosition)
      window.visualViewport?.removeEventListener('scroll', updatePanelPosition)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  const clearAll = () => setNotifications([])
  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))

  const handleNotifClick = (notif: Notification) => {
    markRead(notif.id)
    if (notif.orderId) {
      close()
      navigate('/ordini')
    }
  }

  const toggleOpen = () => {
    if (!open) markAllRead()
    setOpen(prev => !prev)
  }

  const portal =
    open && panelPos
      ? createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-0 bg-black/20"
              style={{ zIndex: OVERLAY_Z }}
              onClick={close}
            />
            <div
              ref={panelRef}
              style={{
                position: 'fixed',
                top: panelPos.top,
                zIndex: MENU_Z,
                ...(panelPos.mode === 'mobile'
                  ? {
                      left: 'max(0.75rem, env(safe-area-inset-left))',
                      right: 'max(0.75rem, env(safe-area-inset-right))',
                      width: 'auto',
                      maxWidth: 'none',
                    }
                  : {
                      right: panelPos.right,
                      width: PANEL_WIDTH,
                      maxWidth: 'calc(100vw - 1rem - env(safe-area-inset-left) - env(safe-area-inset-right))',
                    }),
              }}
              className="aura-glass-dropdown max-w-none overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                <h3 className="font-semibold text-pietra">{t('notifications.title')}</h3>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="text-xs text-fumo transition-colors hover:text-red-400">
                      {t('notifications.clearAll')}
                    </button>
                  )}
                  <button onClick={close} aria-label={t('common.close')} className="premium-topbar-btn !p-1">
                    <AuraIcon icon={X} size="md" />
                  </button>
                </div>
              </div>

              <div className="max-h-[min(20rem,50dvh)] overflow-y-auto divide-y divide-white/[0.06]">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-fumo">
                    <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" strokeWidth={1.25} />
                    <p className="text-sm">{t('notifications.noNotifications')}</p>
                  </div>
                ) : (
                  notifications.map(notif => {
                    const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.new_order
                    const Icon = config.icon
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04]',
                          !notif.read && 'bg-aura-gold/5',
                        )}
                      >
                        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5', config.bg)}>
                          <AuraIcon icon={Icon} size="md" className={config.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-pietra">{notif.message}</p>
                          <p className="mt-1 text-xs text-fumo">{formatDateTime(notif.timestamp)}</p>
                        </div>
                        {!notif.read && (
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-aura-gold" />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={cn(
          'premium-topbar-btn relative',
          open && 'z-[100000]',
        )}
        aria-expanded={open}
        aria-label={t('notifications.title')}
      >
        <AuraIcon icon={Bell} size="lg" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-aura-gold text-xs font-bold text-navy">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {portal}
    </>
  )
}
