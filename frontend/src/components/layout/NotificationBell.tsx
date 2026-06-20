import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X, ShoppingBag, CalendarDays, AlertTriangle, ChefHat } from 'lucide-react'
import { getSocket } from '../../lib/socket'
import { formatDateTime } from '../../lib/utils'
import { cn } from '../../lib/utils'

interface Notification {
  id: string
  type: 'new_order' | 'reservation' | 'low_stock' | 'order_ready'
  message: string
  timestamp: Date
  read: boolean
  orderId?: string
}

const TYPE_CONFIG = {
  new_order: { icon: ShoppingBag, color: 'text-amber-400', bg: 'bg-amber-950/30' },
  reservation: { icon: CalendarDays, color: 'text-blue-500', bg: 'bg-blue-950/40' },
  low_stock: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-950/40' },
  order_ready: { icon: ChefHat, color: 'text-emerald-500', bg: 'bg-emerald-950/40' },
}

const PANEL_WIDTH = 320
const OVERLAY_Z = 99998
const MENU_Z = 99999

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.read).length

  const updatePanelPosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    })
  }, [])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const socket = getSocket()

    const handleNotification = (data: { type: Notification['type']; message: string; orderId?: string }) => {
      const notif: Notification = {
        id: Date.now().toString(),
        type: data.type,
        message: data.message,
        timestamp: new Date(),
        read: false,
        orderId: data.orderId,
      }
      setNotifications(prev => [notif, ...prev].slice(0, 50))

      try {
        const ctx = new AudioContext()
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(800, ctx.currentTime)
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.3)
      } catch {
        // Browser potrebbe bloccare AudioContext senza interazione utente
      }
    }

    socket.on('notification', handleNotification)

    const demoInterval = setInterval(() => {
      if (Math.random() > 0.85) {
        handleNotification({ type: 'new_order', message: 'Nuovo ordine da tavolo 3 — €42.50' })
      }
    }, 30000)

    return () => {
      socket.off('notification', handleNotification)
      clearInterval(demoInterval)
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
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
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
                right: panelPos.right,
                width: PANEL_WIDTH,
                zIndex: MENU_Z,
              }}
              className="glass-dropdown overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="font-semibold text-stone-100">Notifiche</h3>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="text-xs text-stone-500 hover:text-red-500 transition-colors">
                      Cancella tutto
                    </button>
                  )}
                  <button onClick={close}>
                    <X className="w-4 h-4 text-stone-500" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-stone-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nessuna notifica</p>
                  </div>
                ) : (
                  notifications.map(notif => {
                    const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.new_order
                    const Icon = config.icon
                    return (
                      <div
                        key={notif.id}
                        onClick={() => markRead(notif.id)}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition-colors',
                          !notif.read && 'bg-amber-950/20',
                        )}
                      >
                        <div className={`w-8 h-8 ${config.bg} rounded-lg flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-200 leading-snug">{notif.message}</p>
                          <p className="text-xs text-stone-500 mt-1">{formatDateTime(notif.timestamp)}</p>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 bg-amber-600 rounded-full shrink-0 mt-1.5" />
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
          'relative p-2 rounded-lg hover:bg-white/[0.06] transition-colors',
          open && 'z-[100000]',
        )}
        aria-expanded={open}
        aria-label="Notifiche"
      >
        <Bell className="w-5 h-5 text-stone-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-amber-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {portal}
    </>
  )
}
