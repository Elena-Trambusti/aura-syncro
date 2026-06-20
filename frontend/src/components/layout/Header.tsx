import { LogOut, MonitorCheck, ExternalLink, Menu } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials, ROLE_LABELS } from '../../lib/utils'
import { BRAND } from '../../lib/brand'
import NotificationBell from './NotificationBell'
import { useDashboardLayout } from './DashboardLayout'

export default function Header() {
  const { user, logout } = useAuth()
  const { toggleSidebar } = useDashboardLayout()

  return (
    <header className="h-14 sm:h-16 border-b border-stone-800/80 flex items-center justify-between px-3 sm:px-6 shrink-0 bg-[#1f1d1a]/90 backdrop-blur-md gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-stone-300 hover:bg-stone-800/60 hover:text-stone-100 transition-colors shrink-0"
          aria-label="Apri menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <p className="lg:hidden text-sm font-semibold text-stone-200 truncate">{BRAND.name}</p>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <a
          href="/cucina"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium text-stone-400 border border-stone-700/60 rounded-lg hover:bg-stone-800/50 hover:text-amber-400/90 hover:border-amber-800/40 transition-colors"
          title="Apri schermo cucina"
        >
          <MonitorCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cucina</span>
          <ExternalLink className="w-3 h-3 opacity-60 hidden sm:block" />
        </a>

        <NotificationBell />

        <div className="flex items-center gap-1 sm:gap-2 pl-2 sm:pl-3 border-l border-stone-800/80">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center border border-amber-800/30 shrink-0"
            style={{ backgroundColor: `${BRAND.gold}18` }}
          >
            <span className="text-xs font-bold" style={{ color: BRAND.gold }}>
              {user ? getInitials(user.name) : 'U'}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-stone-100 leading-none">{user?.name}</p>
            <p className="text-xs text-stone-500 mt-0.5">{user ? ROLE_LABELS[user.role] || user.role : ''}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-red-950/40 hover:text-red-400 text-stone-500 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
