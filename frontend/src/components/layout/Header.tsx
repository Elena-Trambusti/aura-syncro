import { LogOut, MonitorCheck, ExternalLink } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials, ROLE_LABELS } from '../../lib/utils'
import NotificationBell from './NotificationBell'

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        {/* Link KDS Cucina */}
        <a
          href="/cucina"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition-colors"
          title="Apri schermo cucina"
        >
          <MonitorCheck className="w-3.5 h-3.5" />
          Cucina
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>

        <NotificationBell />

        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
            <span className="text-xs font-bold text-orange-700">
              {user ? getInitials(user.name) : 'U'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-800 leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user ? ROLE_LABELS[user.role] || user.role : ''}</p>
          </div>
          <button
            onClick={logout}
            className="ml-2 p-2 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-400 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
