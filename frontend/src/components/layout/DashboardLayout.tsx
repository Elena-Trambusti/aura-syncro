import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

interface LayoutContextType {
  sidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
}

const LayoutContext = createContext<LayoutContextType | null>(null)

export function useDashboardLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useDashboardLayout must be used within DashboardLayout')
  return ctx
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), [])

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

  return (
    <LayoutContext.Provider value={{ sidebarOpen, openSidebar, closeSidebar, toggleSidebar }}>
      <div className="flex h-[100dvh] overflow-hidden bg-[#f3e4c1]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-br from-[#f8edd2] via-[#f3e4c1] to-[#edd3a0] relative">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-amber-500/25 blur-3xl" />
            <div className="absolute top-1/3 -left-40 h-[420px] w-[420px] rounded-full bg-yellow-400/20 blur-3xl" />
            <div className="absolute bottom-0 right-1/3 h-[360px] w-[360px] rounded-full bg-orange-500/16 blur-3xl" />
          </div>
          <Header />
          <main className="relative z-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  )
}
