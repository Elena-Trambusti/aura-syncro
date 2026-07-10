import { useEffect, useMemo } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, UtensilsCrossed, ClipboardList, BookOpen,
  CalendarDays, Users, UserCog, Package, BarChart3, Settings,
  ChefHat, Star, Megaphone, FileText, CreditCard, Brain, Scale, X, QrCode, Crown, Sparkles, Lock, Receipt, Wallet
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '../../lib/utils'
import { useAuth, useFiscalRegime } from '../../contexts/AuthContext'
import { useAccessTier } from '../../hooks/useAccessTier'
import { usePlanTier } from '../../hooks/usePlanTier'
import { useRole } from '../../hooks/useRole'
import { type Permission } from '../../lib/permissions'
import { BRAND } from '../../lib/brand'
import BrandLogo from '../brand/BrandLogo'
import { useDashboardLayout } from './DashboardLayout'
import { BILLING_PATH, ONBOARDING_PATH, isFreeTierNavItem } from '../../lib/accessTier'
import { prefetchRoute } from '../../lib/routePrefetch'

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
  italyOnly?: boolean
  permission?: Permission
}> = [
  { to: BILLING_PATH, icon: Crown, labelKey: 'nav.billing', billingOnly: true },
  { to: ONBOARDING_PATH, icon: Sparkles, labelKey: 'nav.onboarding', onboardingOnly: true },
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', exact: true },
  { to: '/tavoli', icon: UtensilsCrossed, labelKey: 'nav.tables', permission: 'tables.read' },
  { to: '/ordini', icon: ClipboardList, labelKey: 'nav.orders', permission: 'orders.read' },
  { to: '/cassa', icon: Wallet, labelKey: 'nav.cashDrawer', permission: 'orders.pay' },
  { to: '/prenotazioni', icon: CalendarDays, labelKey: 'nav.reservations', permission: 'reservations.read' },
  { to: '/menu', icon: BookOpen, labelKey: 'nav.menu', permission: 'menu.read' },
  { to: '/dashboard/qr-builder', icon: QrCode, labelKey: 'nav.qrMenu', permission: 'menu.manage' },
  { to: '/crm', icon: Users, labelKey: 'nav.crm', proOnly: true, permission: 'customers.read' },
  { to: '/dashboard/ai-predictive', icon: Brain, labelKey: 'nav.ai', proOnly: true, permission: 'analytics.read' },
  { to: '/fedelta', icon: Star, labelKey: 'nav.loyalty', proOnly: true, permission: 'loyalty.manage' },
  { to: '/marketing', icon: Megaphone, labelKey: 'nav.marketing', proOnly: true, permission: 'marketing.manage' },
  { to: '/pagamenti', icon: CreditCard, labelKey: 'nav.payments', adminOnly: true, proOnly: true, permission: 'payments.overview' },
  { to: '/fatture', icon: Receipt, labelKey: 'nav.invoicesB2b', adminOnly: true, proOnly: true, italyOnly: true },
  { to: '/report', icon: FileText, labelKey: 'nav.reports', exact: true, permission: 'reports.read' },
  { to: '/report/fiscal', icon: Scale, labelKey: 'nav.reportFiscal', exact: true, adminOnly: true, proOnly: true },
  { to: '/dashboard/staff', icon: UserCog, labelKey: 'nav.staff', staffManagersOnly: true },
  { to: '/magazzino', icon: Package, labelKey: 'nav.inventory', permission: 'inventory.read' },
  { to: '/analytics', icon: BarChart3, labelKey: 'nav.analytics', proOnly: true, permission: 'analytics.read' },
  { to: '/impostazioni', icon: Settings, labelKey: 'nav.settings', adminOnly: true },
]

const kitchenLink = { to: '/cucina', icon: ChefHat, labelKey: 'nav.kitchenDisplay', permission: 'orders.read' as const }

export default function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()
  const { restaurant, user } = useAuth()
  const fiscal = useFiscalRegime()
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
      if (item.italyOnly && fiscal.countryCode !== 'IT') return false
      if (item.adminOnly && !canAccessAdminNav()) return false
      if (item.staffManagersOnly && !canManageStaff()) return false
      if (item.permission && !can(item.permission)) return false
      return true
    })
  }, [tier, canAccessAdminNav, canManageStaff, can, fiscal.countryCode])

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
        <div className="relative shrink-0 border-b border-[#D4AF37]/10 lg:px-6 lg:pb-6 lg:pt-8">
          <div className="mb-4 hidden w-full items-center justify-center lg:flex">
            <Link to="/" className="inline-block transition-transform hover:scale-105 hover:opacity-80 active:scale-95" aria-label="Torna alla Home">
              <BrandLogo size="md" showName layout="horizontal" />
            </Link>
          </div>

          <div className="hidden items-center justify-center gap-2.5 pb-4 lg:flex">
            {restaurant?.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[#D4AF37]/50 shadow-[0_0_10px_rgba(212,175,55,0.2)]" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-gradient-to-br from-[#D4AF37]/20 to-transparent shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                <UtensilsCrossed className="h-4 w-4 text-[#D4AF37]" />
              </div>
            )}
            <p
              className="truncate text-base font-medium text-[#F7E7CE] tracking-wide"
              style={{ fontFamily: 'var(--font-display)', textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}
            >
              {restaurant?.name || t('common.restaurant')}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-6 lg:hidden">
            <p
              className="min-w-0 flex-1 truncate pr-2 font-display text-[1.125rem] font-semibold leading-snug tracking-wide text-[#F7E7CE]"
              style={{ textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}
            >
              {restaurant?.name || t('common.restaurant')}
            </p>
            <button
              type="button"
              onClick={closeSidebar}
              className="shrink-0 rounded-lg p-1.5 text-fumo transition-colors hover:bg-white/5 hover:text-pietra"
              aria-label={t('common.closeMenu')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isPreviewMode && (
          <div className="mx-4 mt-2 rounded-lg border border-aura-gold/25 bg-aura-gold/10 px-3 py-2.5 lg:mt-4">
            <p className="text-[11px] leading-relaxed text-champagne/90">
              {tier === 'unsubscribed' ? t('nav.previewUnsubscribed') : t('nav.previewOnboarding')}
            </p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 max-lg:pt-4 lg:py-4 lg:min-h-0">
          <p className="aura-nav-section max-lg:mt-1">{t('nav.operations', { defaultValue: 'Operatività' })}</p>
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
                        <FeatureIcon className="h-[17px] w-[17px]" />
                      </span>
                      <span className="truncate">{t(item.labelKey)}</span>
                      <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-[#C5A059]/50" aria-hidden />
                    </button>
                  ) : (
                    <NavLink
                      to={item.to}
                      className={itemClass}
                      onMouseEnter={() => prefetchRoute(item.to)}
                      onFocus={() => prefetchRoute(item.to)}
                    >
                      <span className={cn('aura-nav-icon', isActive && 'aura-nav-icon--active')}>
                        <FeatureIcon className="h-[17px] w-[17px]" />
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
          {(() => {
            const locked = isPreviewMode
            const FeatureIcon = kitchenLink.icon

            if (locked) {
              return (
                <button
                  type="button"
                  onClick={handleLockedClick}
                  className="premium-nav-item opacity-60"
                  aria-label={`${t(kitchenLink.labelKey)} — ${t('nav.lockedAria')}`}
                >
                  <span className="aura-nav-icon aura-nav-icon--muted">
                    <FeatureIcon className="h-[17px] w-[17px]" />
                  </span>
                  <span className="truncate">{t(kitchenLink.labelKey)}</span>
                  <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-[#C5A059]/50" />
                </button>
              )
            }

            if (!kitchenLink.permission || can(kitchenLink.permission)) {
              const isActive = location.pathname === kitchenLink.to
              return (
                <NavLink
                  to={kitchenLink.to}
                  className={cn('premium-nav-item', isActive && 'premium-nav-item--active')}
                  onMouseEnter={() => prefetchRoute(kitchenLink.to)}
                  onFocus={() => prefetchRoute(kitchenLink.to)}
                >
                  <span className={cn('aura-nav-icon', isActive && 'aura-nav-icon--active')}>
                    <FeatureIcon className="h-[17px] w-[17px]" />
                  </span>
                  <span className="truncate">{t(kitchenLink.labelKey)}</span>
                </NavLink>
              )
            }
            return null
          })()}
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
          <p className="mt-3 hidden text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-fumo/50 lg:block">
            {BRAND.name}
          </p>
        </div>
      </aside>
    </>
  )
}
