import type { Permission } from './permissions'

export interface CommandRoute {
  to: string
  labelKey: string
  keywords: string[]
  adminOnly?: boolean
  staffManagersOnly?: boolean
  proOnly?: boolean
  permission?: Permission
  external?: boolean
}

export const COMMAND_ROUTES: CommandRoute[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', keywords: ['home', 'dashboard', 'executive'] },
  { to: '/tavoli', labelKey: 'nav.tables', keywords: ['tavoli', 'pos', 'sala', 'floor'], permission: 'tables.read' },
  { to: '/ordini', labelKey: 'nav.orders', keywords: ['ordini', 'orders', 'comande'], permission: 'orders.read' },
  { to: '/prenotazioni', labelKey: 'nav.reservations', keywords: ['prenotazioni', 'booking'], permission: 'reservations.read' },
  { to: '/menu', labelKey: 'nav.menu', keywords: ['menu', 'piatti', 'categorie'], permission: 'menu.read' },
  { to: '/dashboard/qr-builder', labelKey: 'nav.qrMenu', keywords: ['qr', 'menu digitale'], permission: 'menu.manage' },
  { to: '/crm', labelKey: 'nav.crm', keywords: ['crm', 'clienti', 'customers'], proOnly: true },
  { to: '/dashboard/ai-predictive', labelKey: 'nav.ai', keywords: ['ai', 'predittiva', 'forecast'], proOnly: true },
  { to: '/fedelta', labelKey: 'nav.loyalty', keywords: ['fedeltà', 'loyalty', 'punti'], proOnly: true },
  { to: '/marketing', labelKey: 'nav.marketing', keywords: ['marketing', 'campagne'], proOnly: true },
  { to: '/pagamenti', labelKey: 'nav.payments', keywords: ['pagamenti', 'stripe'], adminOnly: true, proOnly: true },
  { to: '/report', labelKey: 'nav.reports', keywords: ['report', 'reportistica'], permission: 'reports.read' },
  { to: '/report/fiscal', labelKey: 'nav.reportFiscal', keywords: ['fiscale', 'iva', 'igic'], adminOnly: true, proOnly: true },
  { to: '/dashboard/staff', labelKey: 'nav.staff', keywords: ['staff', 'personale', 'turni'], staffManagersOnly: true },
  { to: '/magazzino', labelKey: 'nav.inventory', keywords: ['magazzino', 'scorte', 'inventory'], permission: 'inventory.read' },
  { to: '/analytics', labelKey: 'nav.analytics', keywords: ['analytics', 'statistiche'], proOnly: true },
  { to: '/impostazioni', labelKey: 'nav.settings', keywords: ['impostazioni', 'settings', 'config'], adminOnly: true },
  { to: '/cucina', labelKey: 'nav.kitchenDisplay', keywords: ['cucina', 'kitchen', 'kds'], permission: 'orders.read' },
]
