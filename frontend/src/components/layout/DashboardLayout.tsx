import { createContext, useContext, useState, useEffect, useCallback, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from './CommandPalette'
import PwaNotificationBanner, { PwaInstallHint } from './PwaNotificationBanner'
import OfflineSyncBanner from '../OfflineSyncBanner'
import PageSkeleton from '../ui/PageSkeleton'
import { useAuth, useTenantQueryKey } from '../../contexts/AuthContext'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { tq } from '../../lib/queryKeys'

interface LayoutContextType {
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
  openCommandPalette: () => void
}

const LayoutContext = createContext<LayoutContextType | null>(null)

export function useDashboardLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useDashboardLayout must be used within DashboardLayout')
  return ctx
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { user } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const tk = useTenantQueryKey()
  usePushNotifications(!!user)

  const handleOfflineSynced = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: tq(tk, 'tables') })
    queryClient.invalidateQueries({ queryKey: tq(tk, 'orders') })
    queryClient.invalidateQueries({ queryKey: tq(tk, 'kitchen', 'orders') })
    queryClient.invalidateQueries({ queryKey: tq(tk, 'menu', 'categories') })
  }, [queryClient, tk])

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), [])
  const openCommandPalette = useCallback(() => setCommandOpen(true), [])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <LayoutContext.Provider value={{ sidebarOpen, openSidebar, closeSidebar, toggleSidebar, openCommandPalette }}>
      <div className="pwa-app-shell relative bg-transparent z-0">
        {/* Sfondo ultra-profondo Ossidiana */}
        <div className="fixed inset-0 z-[-5] bg-[#0A0A0E]" />
        
        {/* Effetto Glow Specchiato (Ambient Glow dietro il vetro) */}
        <div className="fixed inset-0 z-[-4] pointer-events-none bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(197,160,89,0.06)_0%,rgba(255,255,255,0.01)_30%,rgba(0,0,0,0.8)_100%)]" />
        
        {/* Glow ambientale di riflesso dal basso */}
        <div className="fixed inset-0 z-[-3] pointer-events-none bg-[radial-gradient(ellipse_100%_50%_at_50%_100%,rgba(197,160,89,0.03)_0%,rgba(0,0,0,0)_100%)]" />
        


        <Sidebar />
        <div className="dashboard-main flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden !bg-transparent !bg-none">
          <Header />
          <main className="pwa-main-scroll relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2.5 pb-[max(calc(var(--safe-bottom,0px)+4rem),4.75rem)] sm:p-6 sm:pb-6 lg:p-8 lg:pb-8">
            <div className="dashboard-top-alerts pointer-events-none fixed inset-x-0 z-40 flex flex-col-reverse gap-2 px-3 sm:px-6 lg:hidden">
              <div className="pointer-events-auto">
                <PwaInstallHint />
              </div>
              <div className="pointer-events-auto">
                <PwaNotificationBanner enabled={!!user} />
              </div>
            </div>
            <div className="dashboard-inline-alerts mb-3 hidden space-y-3 lg:block">
              <PwaInstallHint />
              <PwaNotificationBanner enabled={!!user} />
            </div>
            <OfflineSyncBanner enabled={!!user} onSynced={handleOfflineSynced} className="mb-3" />
            <Suspense
              fallback={(
                <div className="min-h-[50vh]">
                  <PageSkeleton variant="kpi" count={4} className="mb-6" />
                  <PageSkeleton variant="list" count={4} />
                </div>
              )}
            >
              <div key={location.pathname} className="pwa-mobile-page pwa-kpi-compact min-h-0">
                <Outlet />
              </div>
            </Suspense>
          </main>
        </div>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </LayoutContext.Provider>
  )
}
