import { LogOut, MonitorCheck, ExternalLink } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials, ROLE_LABELS } from '../../lib/utils'
import { BRAND } from '../../lib/brand'
import NotificationBell from './NotificationBell'

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-16 border-b border-stone-800/80 flex items-center justify-between px-6 shrink-0 bg-[#1f1d1a]/90 backdrop-blur-md">
      <div />
      <div className="flex items-center gap-3">
        <a
          href="/cucina"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-400 border border-stone-700/60 rounded-lg hover:bg-stone-800/50 hover:text-amber-400/90 hover:border-amber-800/40 transition-colors"
          title="Apri schermo cucina"
        >
          <MonitorCheck className="w-3.5 h-3.5" />
          Cucina
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>

        <NotificationBell />

        <div className="flex items-center gap-2 pl-3 border-l border-stone-800/80">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center border border-amber-800/30"
            style={{ backgroundColor: `${BRAND.gold}18` }}
          >
            <span className="text-xs font-bold" style={{ color: BRAND.gold }}>
              {user ? getInitials(user.name) : 'U'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-stone-100 leading-none">{user?.name}</p>
            <p className="text-xs text-stone-500 mt-0.5">{user ? ROLE_LABELS[user.role] || user.role : ''}</p>
          </div>
          <button
            onClick={logout}
            className="ml-2 p-2 rounded-lg hover:bg-red-950/40 hover:text-red-400 text-stone-500 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
