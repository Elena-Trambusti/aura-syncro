import { NavLink } from 'react-router-dom'
import { LogOut, MonitorCheck, ExternalLink, Menu, Radio, UtensilsCrossed, ClipboardList, CalendarDays, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials, cn } from '../../lib/utils'
import BrandLogo from '../brand/BrandLogo'
import NotificationBell from './NotificationBell'
import LanguageSwitcher from './LanguageSwitcher'
import { useDashboardLayout } from './DashboardLayout'

const QUICK_LINKS = [
  { to: '/tavoli', icon: UtensilsCrossed, labelKey: 'nav.tables' },
  { to: '/ordini', icon: ClipboardList, labelKey: 'nav.orders' },
  { to: '/prenotazioni', icon: CalendarDays, labelKey: 'nav.reservations' },
] as const

export default function Header() {
  const { t } = useTranslation()
  const { user, logout, restaurant } = useAuth()
  const { toggleSidebar, sidebarOpen, openCommandPalette } = useDashboardLayout()

  const roleLabel = user
    ? t(`status.role.${user.role}`, { defaultValue: user.role })
    : ''

  return (
    <header className={cn('aura-topbar pwa-header flex h-14 shrink-0 items-center gap-2 px-3 sm:h-[4.25rem] sm:gap-3 sm:px-5', sidebarOpen && 'max-lg:z-30')}>
      <button
        type="button"
        onClick={toggleSidebar}
        className={cn('premium-topbar-btn -ml-0.5 shrink-0 lg:hidden', sidebarOpen && 'premium-topbar-btn--active')}
        aria-label={t('common.openMenu')}
        aria-expanded={sidebarOpen}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <div className="shrink-0 lg:hidden">
          <BrandLogo size="sm" showName layout="horizontal" />
        </div>

        <div className="aura-topbar-context hidden lg:inline-flex">
          <Radio className="h-3 w-3 shrink-0 text-aura-gold" aria-hidden />
          <span className="truncate max-w-[14rem] font-medium">
            {restaurant?.name || t('common.restaurant')}
          </span>
        </div>

        <button
          type="button"
          onClick={openCommandPalette}
          className="aura-topbar-search hidden md:flex w-48 shrink-0"
          aria-label={t('commandPalette.title', { defaultValue: 'Navigazione rapida' })}
        >
          <Search className="h-4 w-4 shrink-0 text-fumo/50" aria-hidden />
          <span className="truncate text-left">{t('commandPalette.shortPlaceholder', { defaultValue: 'Cerca sezione…' })}</span>
        </button>

        <nav className="aura-topbar-quick hidden lg:flex" aria-label={t('dashboard.quickNav', { defaultValue: 'Accesso rapido' })}>
          {QUICK_LINKS.map(link => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn('aura-topbar-quick__link', isActive && 'aura-topbar-quick__link--active')
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="hidden 2xl:inline">{t(link.labelKey)}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className="premium-topbar-btn hidden sm:flex md:hidden"
          aria-label={t('commandPalette.title')}
        >
          <Search className="h-5 w-5" />
        </button>



        <div className="aura-topbar-cluster">
          <a
            href="/cucina"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fumo transition-colors hover:bg-white/[0.05] hover:text-aura-gold sm:flex"
            title={t('nav.openKitchenDisplay')}
          >
            <MonitorCheck className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">{t('nav.kitchenDisplay')}</span>
            <ExternalLink className="hidden h-3 w-3 opacity-40 2xl:block" />
          </a>

          <LanguageSwitcher />
          <NotificationBell />
        </div>

        <div className="aura-topbar-profile">
          <div className="premium-avatar">
            {user ? getInitials(user.name) : 'U'}
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-medium leading-none text-pietra">{user?.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-fumo">{roleLabel}</p>
          </div>
          <button
            type="button"
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
