import { useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
import { getTenantTheme } from '../../lib/tenantTheme'
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
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', exact: true },
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
  const { restaurant } = useAuth()
  const { tier } = useAccessTier()
  const { hasProPlan } = usePlanTier()
  const { canAccessAdminNav, canManageStaff, can } = useRole()
  const theme = getTenantTheme(restaurant?.colorTheme)
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
    if (tier === 'unsubscribed') {
      if (item.billingOnly) return false
      if (isFreeTierNavItem(item.to, item.exact)) return false
      return true
    }
    if (tier === 'onboarding') return !item.onboardingOnly
    if (item.proOnly && !hasProPlan) return true
    return false
  }

  function handleLockedClick() {
    if (tier === 'unsubscribed') {
      toast(t('nav.lockedPremium'), { icon: '🔒' })
    } else if (tier === 'onboarding') {
      toast(t('nav.lockedOnboarding'), { icon: '⏳' })
    } else {
      toast(t('nav.lockedPro'), { icon: '🔒' })
    }
  }

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

        {isPreviewMode && (
          <div className="mx-3 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-[11px] leading-relaxed text-amber-100/90">
              {tier === 'unsubscribed' ? t('nav.previewUnsubscribed') : t('nav.previewOnboarding')}
            </p>
          </div>
        )}

        <nav className="flex-1 py-3 px-3 overflow-y-auto overscroll-contain">
          <ul className="space-y-1">
            {visibleNavItems.map(item => {
              const locked = isItemLocked(item)
              const isProLocked = !locked && item.proOnly && !hasProPlan
              const FeatureIcon = item.icon
              const isActive = !locked && (item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to))

              const itemClass = cn(
                'flex w-full items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                locked
                  ? 'text-slate-400 hover:bg-slate-800/60'
                  : isActive
                    ? 'text-white font-semibold bg-slate-800'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                isProLocked && !isActive && 'text-slate-400',
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
                      <FeatureIcon className="w-5 h-5 shrink-0 opacity-45" />
                      <span className="truncate opacity-75">{t(item.labelKey)}</span>
                      <Lock className="ml-auto w-3.5 h-3.5 shrink-0 text-amber-500/70" aria-hidden />
                    </button>
                  ) : (
                    <NavLink to={item.to} className={itemClass}>
                      <FeatureIcon className={cn('w-5 h-5 shrink-0', isProLocked && 'text-violet-400/90')} />
                      {t(item.labelKey)}
                      {isProLocked && (
                        <span className="ml-auto rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-300">
                          Pro
                        </span>
                      )}
                    </NavLink>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-3 pb-2 border-t border-slate-800 pt-3">
          {externalLinks.map(link => {
            const locked = isPreviewMode
            const FeatureIcon = link.icon

            if (locked) {
              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={handleLockedClick}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/60 text-left"
                  aria-label={`${t(link.labelKey)} — ${t('nav.lockedAria')}`}
                >
                  <FeatureIcon className="w-5 h-5 shrink-0 opacity-45" />
                  <span className="truncate opacity-75">{t(link.labelKey)}</span>
                  <Lock className="ml-auto w-3.5 h-3.5 shrink-0 text-amber-500/70" />
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                >
                  <FeatureIcon className="w-5 h-5 shrink-0" />
                  {t(link.labelKey)}
                  <span className="ml-auto text-xs opacity-50">↗</span>
                </a>
              )
            }
            return null
          })}
        </div>

        <div className="p-4 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 text-center tracking-wider uppercase">{BRAND.name} · v2.0</p>
        </div>
      </aside>
    </>
  )
}
