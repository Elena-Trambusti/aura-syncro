import { Link, NavLink } from 'react-router-dom'
import { LogOut, MonitorCheck, Menu, Radio, UtensilsCrossed, ClipboardList, CalendarDays, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials, cn } from '../../lib/utils'
import { triggerHaptic } from '../../lib/haptics'
import AuraIcon from '../ui/AuraIcon'
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
    <header className={cn('aura-topbar pwa-header flex shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-5', sidebarOpen && 'max-lg:z-30')}>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('soft')
          toggleSidebar()
        }}
        className={cn('premium-topbar-btn aura-focus-ring -ml-0.5 shrink-0 lg:hidden', sidebarOpen && 'premium-topbar-btn--active')}
        aria-label={t('common.openMenu')}
        aria-expanded={sidebarOpen}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-4">
        <div className="aura-topbar-context hidden lg:inline-flex">
          <Radio className="h-3 w-3 shrink-0 text-aura-gold" aria-hidden />
          <span className="truncate max-w-[14rem] font-medium">
            {restaurant?.name || t('common.restaurant')}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('soft')
            openCommandPalette()
          }}
          className="aura-topbar-search aura-focus-ring min-w-0 max-w-[10rem] shrink xl:max-w-md"
          aria-label={t('commandPalette.title', { defaultValue: 'Navigazione rapida' })}
        >
          <AuraIcon icon={Search} size="sm" className="aura-topbar-search__icon" />
          <span className="aura-topbar-search__label">
            {t('commandPalette.shortPlaceholder', { defaultValue: 'Cerca sezione…' })}
          </span>
        </button>

        <nav className="aura-topbar-quick hidden lg:flex" aria-label={t('dashboard.quickNav', { defaultValue: 'Accesso rapido' })}>
          {QUICK_LINKS.map(link => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn('aura-topbar-quick__link aura-focus-ring', isActive && 'aura-topbar-quick__link--active')
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
          className="premium-topbar-btn premium-topbar-btn--icon aura-focus-ring hidden sm:inline-flex lg:hidden"
          aria-label={t('commandPalette.title')}
        >
          <AuraIcon icon={Search} size="md" className="text-fumo/70" />
        </button>



        <div className="aura-topbar-cluster">
          <Link
            to="/cucina"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fumo transition-colors hover:bg-white/[0.05] hover:text-aura-gold sm:flex aura-focus-ring"
            title={t('nav.openKitchenDisplay')}
          >
            <MonitorCheck className="h-3.5 w-3.5" />
            <span className="hidden 2xl:inline">{t('nav.kitchenDisplay')}</span>
          </Link>

          <LanguageSwitcher compact />
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
            onClick={() => {
              triggerHaptic('warning')
              logout()
            }}
            className="premium-topbar-btn aura-focus-ring hover:!bg-rose-500/[0.1] hover:!text-rose-300"
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
