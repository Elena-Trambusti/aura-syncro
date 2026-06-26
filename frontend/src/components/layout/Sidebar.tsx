import { useEffect, useMemo } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, BookOpen,
  CalendarDays, Users, UserCog, Package, BarChart3, Settings,
  ChefHat, Star, Megaphone, FileText, CreditCard, Brain, Scale, X, QrCode, Crown, Sparkles, Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { useAccessTier } from '../../hooks/useAccessTier'
import { usePlanTier } from '../../hooks/usePlanTier'
import { useRole } from '../../hooks/useRole'
import { type Permission } from '../../lib/permissions'
import { BRAND } from '../../lib/brand'
import BrandLogo from '../brand/BrandLogo'
import { useDashboardLayout } from './DashboardLayout'
import { BILLING_PATH, ONBOARDING_PATH, isFreeTierNavItem } from '../../lib/accessTier'

const navItems: Array<{
  to: string
  icon: typeof LayoutDashboard
  labelKey: string
  exact?: boolean
  adminOnly?: boolean
  staffManagersOnly?: boolean
  billingOnly?: boolean
  onboardingOnly?: boolean
  proOnly?: boolean
  permission?: Permission
}> = [
  { to: BILLING_PATH, icon: Crown, labelKey: 'nav.billing', billingOnly: true },
  { to: ONBOARDING_PATH, icon: Sparkles, labelKey: 'nav.onboarding', onboardingOnly: true },
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', exact: true },
  { to: '/tavoli', icon: UtensilsCrossed, labelKey: 'nav.tables', permission: 'tables.read' },
  { to: '/ordini', icon: ClipboardList, labelKey: 'nav.orders', permission: 'orders.read' },
  { to: '/prenotazioni', icon: CalendarDays, labelKey: 'nav.reservations', permission: 'reservations.read' },
  { to: '/menu', icon: BookOpen, labelKey: 'nav.menu', permission: 'menu.read' },
  { to: '/dashboard/qr-builder', icon: QrCode, labelKey: 'nav.qrMenu', permission: 'menu.manage' },
  { to: '/crm', icon: Users, labelKey: 'nav.crm', proOnly: true },
  { to: '/dashboard/ai-predictive', icon: Brain, labelKey: 'nav.ai', proOnly: true },
  { to: '/fedelta', icon: Star, labelKey: 'nav.loyalty', proOnly: true },
  { to: '/marketing', icon: Megaphone, labelKey: 'nav.marketing', proOnly: true },
  { to: '/pagamenti', icon: CreditCard, labelKey: 'nav.payments', adminOnly: true, proOnly: true },
  { to: '/report', icon: FileText, labelKey: 'nav.reports', exact: true, permission: 'reports.read' },
  { to: '/report/fiscal', icon: Scale, labelKey: 'nav.reportFiscal', exact: true, adminOnly: true, proOnly: true },
  { to: '/dashboard/staff', icon: UserCog, labelKey: 'nav.staff', staffManagersOnly: true },
  { to: '/magazzino', icon: Package, labelKey: 'nav.inventory', permission: 'inventory.read' },
  { to: '/analytics', icon: BarChart3, labelKey: 'nav.analytics', proOnly: true },
  { to: '/impostazioni', icon: Settings, labelKey: 'nav.settings', adminOnly: true },
]

const externalLinks: Array<{
  href: string
  icon: typeof ChefHat
  labelKey: string
  permission?: Permission
}> = [
  { href: '/cucina', icon: ChefHat, labelKey: 'nav.kitchenDisplay', permission: 'orders.read' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const { restaurant, user } = useAuth()
  const { tier } = useAccessTier()
  const { hasProPlan } = usePlanTier()
  const { canAccessAdminNav, canManageStaff, can } = useRole()
  const { sidebarOpen, closeSidebar } = useDashboardLayout()

  const isPreviewMode = tier === 'unsubscribed' || tier === 'onboarding'

  useEffect(() => {
    closeSidebar()
  }, [location.pathname, closeSidebar])

  const visibleNavItems = useMemo(() => {
    const catalog = navItems.filter(item => !item.billingOnly && !item.onboardingOnly)

    if (tier === 'unsubscribed') {
      const billing = navItems.find(item => item.billingOnly)!
      return [billing, ...catalog]
    }

    if (tier === 'onboarding') {
      const onboarding = navItems.find(item => item.onboardingOnly)!
      return [onboarding, ...catalog]
    }

    return navItems.filter(item => {
      if (item.billingOnly || item.onboardingOnly) return false
      if (item.adminOnly && !canAccessAdminNav()) return false
      if (item.staffManagersOnly && !canManageStaff()) return false
      if (item.permission && !can(item.permission)) return false
      return true
    })
  }, [tier, canAccessAdminNav, canManageStaff, can])

  function isItemLocked(item: (typeof navItems)[number]): boolean {
    if (item.proOnly && !hasProPlan) return true

    if (tier === 'unsubscribed') {
      if (item.billingOnly) return false
      if (isFreeTierNavItem(item.to, item.exact)) return false
      return true
    }
    if (tier === 'onboarding') return !item.onboardingOnly
    return false
  }

  function handleLockedClick() {
    if (tier === 'unsubscribed') {
      toast(t('nav.lockedPremium'), { icon: '🔒' })
    } else if (tier === 'onboarding') {
      toast(t('nav.lockedOnboarding'), { icon: '⏳' })
    } else {
      toast(t('nav.lockedPremium'), { icon: '🔒' })
    }
  }

  const roleLabel = user
    ? t(`status.role.${user.role}`, { defaultValue: user.role })
    : ''

  return (
    <>
      <div
        className={cn(
          'max-lg:fixed max-lg:inset-0 max-lg:z-[60] max-lg:bg-black/75 max-lg:backdrop-blur-md max-lg:transition-opacity',
          sidebarOpen ? 'max-lg:opacity-100 max-lg:pointer-events-auto' : 'max-lg:pointer-events-none max-lg:opacity-0',
          'lg:hidden',
        )}
        onClick={closeSidebar}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={cn(
          'premium-sidebar w-[18.5rem] lg:w-[19.5rem]',
          'max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:z-[70]',
          'max-lg:w-[min(304px,88vw)]',
          'max-lg:transition-transform max-lg:duration-300 max-lg:ease-out',
          sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
        )}
        aria-label={t('common.mainMenu')}
      >
        <div className="relative px-6 pt-8 pb-6 flex flex-col gap-6 shrink-0">
          <button
            type="button"
            onClick={closeSidebar}
            className="absolute top-5 right-5 lg:hidden text-fumo hover:text-pietra transition-colors"
            aria-label={t('common.closeMenu')}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center w-full">
            <Link to="/" className="inline-block transition-transform hover:scale-105 hover:opacity-80 active:scale-95" aria-label="Torna alla Home">
              <BrandLogo size="md" showName layout="horizontal" />
            </Link>
          </div>

          <div className="flex items-center justify-center mx-auto w-full gap-2.5">
            {restaurant?.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-5 w-5 shrink-0 rounded-sm object-cover ring-1 ring-white/10" />
            ) : (
              <UtensilsCrossed className="h-4 w-4 shrink-0 text-fumo" />
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="truncate text-sm font-medium text-pietra">{restaurant?.name || t('common.restaurant')}</p>
            </div>
          </div>
        </div>

        {isPreviewMode && (
          <div className="mx-4 mt-4 rounded-lg border border-aura-gold/25 bg-aura-gold/10 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-champagne/90">
              {tier === 'unsubscribed' ? t('nav.previewUnsubscribed') : t('nav.previewOnboarding')}
            </p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 lg:min-h-0">
          <p className="aura-nav-section">{t('nav.operations', { defaultValue: 'Operatività' })}</p>
          <ul className="space-y-0.5">
            {visibleNavItems.map(item => {
              const locked = isItemLocked(item)
              const FeatureIcon = item.icon
              const isActive = !locked && (item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to))

              const itemClass = cn(
                'premium-nav-item',
                locked && 'opacity-60',
                !locked && isActive && 'premium-nav-item--active',
              )

              return (
                <li key={item.to}>
                  {locked ? (
                    <button
                      type="button"
                      onClick={handleLockedClick}
                      className={itemClass}
                      aria-label={`${t(item.labelKey)} — ${t('nav.lockedAria')}`}
                    >
                      <span className="aura-nav-icon aura-nav-icon--muted">
                        <FeatureIcon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                      </span>
                      <span className="truncate">{t(item.labelKey)}</span>
                      <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-aura-gold/60" aria-hidden />
                    </button>
                  ) : (
                    <NavLink to={item.to} className={itemClass}>
                      <span className={cn('aura-nav-icon', isActive && 'aura-nav-icon--active')}>
                        <FeatureIcon
                          className={cn('h-[17px] w-[17px]', isActive ? 'text-aura-gold' : '')}
                          strokeWidth={isActive ? 2.25 : 1.75}
                        />
                      </span>
                      <span className="truncate">{t(item.labelKey)}</span>
                    </NavLink>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-white/[0.06] px-3 py-3">
          {externalLinks.map(link => {
            const locked = isPreviewMode
            const FeatureIcon = link.icon

            if (locked) {
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={handleLockedClick}
                  className="premium-nav-item opacity-60"
                  aria-label={`${t(link.labelKey)} — ${t('nav.lockedAria')}`}
                >
                  <span className="aura-nav-icon aura-nav-icon--muted">
                    <FeatureIcon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  </span>
                  <span className="truncate">{t(link.labelKey)}</span>
                  <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-aura-gold/60" />
                </button>
              )
            }

            if (!link.permission || can(link.permission)) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="premium-nav-item"
                >
                  <span className="aura-nav-icon">
                    <FeatureIcon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  </span>
                  {t(link.labelKey)}
                  <span className="ml-auto text-xs opacity-40">↗</span>
                </a>
              )
            }
            return null
          })}
        </div>

        <div className="border-t border-white/[0.06] p-4">
          {user && (
            <div className="aura-sidebar-user">
              <div className="premium-avatar premium-avatar--lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-pietra">{user.name}</p>
                <p className="truncate text-[11px] text-fumo">{roleLabel}</p>
              </div>
            </div>
          )}
          <p className="mt-3 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-fumo/50">
            {BRAND.name}
          </p>
        </div>
      </aside>
    </>
  )
}
