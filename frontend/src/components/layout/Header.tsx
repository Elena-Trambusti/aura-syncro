import { Search, LogOut, MonitorCheck, ExternalLink, Menu, Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials, cn } from '../../lib/utils'
import BrandLogo from '../brand/BrandLogo'
import NotificationBell from './NotificationBell'
import LanguageSwitcher from './LanguageSwitcher'
import { useDashboardLayout } from './DashboardLayout'

export default function Header() {
  const { t } = useTranslation()
  const { user, logout, restaurant } = useAuth()
  const { toggleSidebar, sidebarOpen } = useDashboardLayout()

  const roleLabel = user
    ? t(`status.role.${user.role}`, { defaultValue: user.role })
    : ''

  return (
    <header className={cn('aura-topbar pwa-header flex h-[3.25rem] shrink-0 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5', sidebarOpen && 'max-lg:z-30')}>
      <button
        type="button"
        onClick={toggleSidebar}
        className={cn('premium-topbar-btn -ml-0.5 shrink-0 lg:hidden', sidebarOpen && 'premium-topbar-btn--active')}
        aria-label={t('common.openMenu')}
        aria-expanded={sidebarOpen}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0 lg:hidden">
          <BrandLogo size="sm" />
        </div>

        <div className="aura-topbar-search">
          <Search className="h-4 w-4 shrink-0 text-fumo/50" aria-hidden />
          <span>{t('common.search', { defaultValue: 'Cerca ordini, tavoli, clienti…' })}</span>
        </div>

        <div className="aura-topbar-context hidden lg:inline-flex">
          <Radio className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate max-w-[12rem]">
            {restaurant?.name || t('common.restaurant')}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="aura-topbar-cluster">
          <a
            href="/cucina"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fumo transition-colors hover:bg-white/[0.05] hover:text-aura-gold sm:flex"
            title={t('nav.openKitchenDisplay')}
          >
            <MonitorCheck className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t('nav.kitchenDisplay')}</span>
            <ExternalLink className="hidden h-3 w-3 opacity-40 md:block" />
          </a>

          <LanguageSwitcher />
          <NotificationBell />
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-navy-surface/50 py-1 pl-1 pr-1.5 sm:gap-2 sm:pl-1.5 sm:pr-2">
          <div className="premium-avatar">
            {user ? getInitials(user.name) : 'U'}
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-medium leading-none text-pietra">{user?.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-fumo">{roleLabel}</p>
          </div>
          <button
            onClick={logout}
            className="premium-topbar-btn hover:!bg-rose-500/[0.1] hover:!text-rose-300"
            title={t('common.logout')}
            aria-label={t('common.logout')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
