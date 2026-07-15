/** Prefetch lazy route chunks on sidebar hover/focus. */

const prefetched = new Set<string>()

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/tavoli': () => import('../pages/TablesPage'),
  '/ordini': () => import('../pages/OrdersPage'),
  '/cassa': () => import('../pages/CashDrawerPage'),
  '/menu': () => import('../pages/MenuPage'),
  '/prenotazioni': () => import('../pages/ReservationsPage'),
  '/crm': () => import('../pages/CrmPage'),
  '/magazzino': () => import('../pages/InventoryPage'),
  '/analytics': () => import('../pages/AnalyticsPage'),
  '/fedelta': () => import('../pages/LoyaltyPage'),
  '/marketing': () => import('../pages/MarketingPage'),
  '/report': () => import('../pages/ReportsPage'),
  '/report/fiscal': () => import('../pages/ReportFiscal'),
  '/pagamenti': () => import('../pages/PaymentsPage'),
  '/fatture': () => import('../pages/InvoicesPage'),
  '/dashboard/ai-predictive': () => import('../pages/AIPredictivePage'),
  '/dashboard/qr-builder': () => import('../pages/QRBuilderPage'),
  '/dashboard/staff': () => import('../pages/StaffPage'),
  '/dashboard/billing': () => import('../pages/BillingPage'),
  '/dashboard/onboarding': () => import('../pages/OnboardingPage'),
  '/impostazioni': () => import('../pages/SettingsPage'),
  '/dashboard/settings/hardware': () => import('../pages/HardwareSettingsPage'),
  '/profilo': () => import('../pages/ProfilePage'),
  '/cucina': () => import('../pages/KitchenDisplayPage'),
}

function normalizePath(path: string): string {
  const base = path.split('?')[0].replace(/\/$/, '') || '/'
  return base
}

export function prefetchRoute(path: string): void {
  const normalized = normalizePath(path)
  if (prefetched.has(normalized)) return
  const loader = routeLoaders[normalized]
  if (!loader) return
  prefetched.add(normalized)
  void loader()
}
