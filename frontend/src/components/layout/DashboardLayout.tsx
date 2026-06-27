import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from './CommandPalette'
import PwaNotificationBanner, { PwaInstallHint } from './PwaNotificationBanner'
import OfflineSyncBanner from '../OfflineSyncBanner'
import DemoBanner from '../DemoBanner'
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
      <div className="pwa-app-shell relative bg-[#020202] z-0">
        {/* Pure black base */}
        <div className="fixed inset-0 z-[-4] bg-black" />
        
        {/* Luxury glowing orbs */}
        <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-aura-gold/20 mix-blend-screen blur-[120px] pointer-events-none animate-[float_15s_ease-in-out_infinite]" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-amber-600/15 mix-blend-screen blur-[120px] pointer-events-none animate-[float_20s_ease-in-out_infinite_reverse]" />
        
        {/* Top gold spotlight */}
        <div className="fixed inset-0 z-[-3] pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.15),rgba(0,0,0,0))]" />
        


        <Sidebar />
        <div className="dashboard-main flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden !bg-transparent !bg-none">
          <Header />
          <main className="pwa-main-scroll relative z-0 flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
            <PwaInstallHint />
            <PwaNotificationBanner enabled={!!user} />
            <OfflineSyncBanner enabled={!!user} onSynced={handleOfflineSynced} className="mb-3" />
            <DemoBanner />
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </LayoutContext.Provider>
  )
}
