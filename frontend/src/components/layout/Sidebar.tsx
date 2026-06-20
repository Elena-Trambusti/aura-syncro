import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, BookOpen,
  CalendarDays, Users, UserCog, Package, BarChart3, Settings,
  ChefHat, Star, Megaphone, FileText, CreditCard, Brain, Scale, X, QrCode, Crown, Lock,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth, useSubscription } from '../../contexts/AuthContext'
import { getTenantTheme } from '../../lib/tenantTheme'
import { BRAND } from '../../lib/brand'
import BrandLogo from '../brand/BrandLogo'
import { useDashboardLayout } from './DashboardLayout'

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', exact: true },
  { to: '/tavoli', icon: UtensilsCrossed, labelKey: 'nav.tables' },
  { to: '/ordini', icon: ClipboardList, labelKey: 'nav.orders' },
  { to: '/prenotazioni', icon: CalendarDays, labelKey: 'nav.reservations' },
  { to: '/menu', icon: BookOpen, labelKey: 'nav.menu' },
  { to: '/dashboard/qr-builder', icon: QrCode, labelKey: 'nav.qrMenu' },
  { to: '/crm', icon: Users, labelKey: 'nav.crm', premium: true },
  { to: '/dashboard/ai-predictive', icon: Brain, labelKey: 'nav.ai', premium: true },
  { to: '/fedelta', icon: Star, labelKey: 'nav.loyalty' },
  { to: '/marketing', icon: Megaphone, labelKey: 'nav.marketing', premium: true },
  { to: '/pagamenti', icon: CreditCard, labelKey: 'nav.payments' },
  { to: '/dashboard/billing', icon: Crown, labelKey: 'nav.billing' },
  { to: '/report', icon: FileText, labelKey: 'nav.reports', exact: true },
  { to: '/report/fiscal', icon: Scale, labelKey: 'nav.reportFiscal', exact: true, premium: true },
  { to: '/personale', icon: UserCog, labelKey: 'nav.staff' },
  { to: '/magazzino', icon: Package, labelKey: 'nav.inventory' },
  { to: '/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
  { to: '/impostazioni', icon: Settings, labelKey: 'nav.settings' },
]

const externalLinks = [
  { href: '/cucina', icon: ChefHat, labelKey: 'nav.kitchenDisplay' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const { restaurant } = useAuth()
  const { hasActiveSubscription } = useSubscription()
  const theme = getTenantTheme(restaurant?.colorTheme)
  const { sidebarOpen, closeSidebar } = useDashboardLayout()

  useEffect(() => {
    closeSidebar()
  }, [location.pathname, closeSidebar])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 transition-opacity lg:hidden',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={closeSidebar}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(280px,88vw)] flex-col bg-slate-900 border-r border-slate-800',
          'transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-64 lg:shrink-0 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={t('common.mainMenu')}
      >
        <div className="p-4 sm:p-6 border-b border-slate-800">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <BrandLogo size="md" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-white tracking-wide">{BRAND.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t('brand.saasPlatform')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label={t('common.closeMenu')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-slate-800 border border-slate-700">
            {restaurant?.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: theme.color }}>
                <UtensilsCrossed className="w-4 h-4 text-slate-900" />
              </div>
            )}
            <p className="text-xs font-medium text-slate-200 truncate">{restaurant?.name || t('common.restaurant')}</p>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto overscroll-contain">
          <ul className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const isPremiumLocked = item.premium && !hasActiveSubscription
              const NavIcon = isPremiumLocked ? Lock : Icon
              const isActive = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to)

              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'text-white font-semibold bg-slate-800'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      isPremiumLocked && !isActive && 'text-slate-400',
                    )}
                  >
                    <NavIcon className={cn('w-5 h-5 shrink-0', isPremiumLocked && 'text-amber-400/90')} />
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-3 pb-2 border-t border-slate-800 pt-3">
          {externalLinks.map(link => {
            const Icon = link.icon
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
              >
                <Icon className="w-5 h-5 shrink-0" />
                {t(link.labelKey)}
                <span className="ml-auto text-xs opacity-50">↗</span>
              </a>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 text-center tracking-wider uppercase">{BRAND.name} · v2.0</p>
        </div>
      </aside>
    </>
  )
}
