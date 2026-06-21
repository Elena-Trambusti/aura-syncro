import { LogOut, MonitorCheck, ExternalLink, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials } from '../../lib/utils'
import BrandLogo from '../brand/BrandLogo'
import NotificationBell from './NotificationBell'
import LanguageSwitcher from './LanguageSwitcher'
import { useDashboardLayout } from './DashboardLayout'

export default function Header() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const { toggleSidebar } = useDashboardLayout()

  const roleLabel = user
    ? t(`status.role.${user.role}`, { defaultValue: user.role })
    : ''

  return (
    <header className="pwa-header relative z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:h-16 sm:px-6">
      <div className="flex items-center gap-2 min-w-0 lg:min-w-[4.5rem]">
        <button
          type="button"
          onClick={toggleSidebar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          aria-label={t('common.openMenu')}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center lg:hidden">
        <BrandLogo size="sm" className="shadow-none border border-amber-200/80" />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <a
          href="/cucina"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-amber-600 hover:border-amber-300 transition-colors"
          title={t('nav.openKitchenDisplay')}
        >
          <MonitorCheck className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('nav.kitchenDisplay')}</span>
          <ExternalLink className="w-3 h-3 opacity-60 hidden sm:block" />
        </a>

        <LanguageSwitcher />

        <NotificationBell />

        <div className="flex items-center gap-1 sm:gap-2 pl-2 sm:pl-3 border-l border-slate-200">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center border border-amber-300 bg-amber-50 shrink-0"
          >
            <span className="text-xs font-bold text-amber-600">
              {user ? getInitials(user.name) : 'U'}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-900 leading-none">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{roleLabel}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-500 transition-colors"
            title={t('common.logout')}
            aria-label={t('common.logout')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
