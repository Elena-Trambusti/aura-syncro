import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList, BookOpen,
  CalendarDays, Users, UserCog, Package, BarChart3, Settings,
  ChefHat, Star, Megaphone, FileText, CreditCard, Brain, Scale,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'
import { getTenantTheme } from '../../lib/tenantTheme'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/tavoli', icon: UtensilsCrossed, label: 'Tavoli & POS' },
  { to: '/ordini', icon: ClipboardList, label: 'Ordini' },
  { to: '/prenotazioni', icon: CalendarDays, label: 'Prenotazioni' },
  { to: '/menu', icon: BookOpen, label: 'Menu' },
  { to: '/clienti', icon: Users, label: 'Clienti CRM' },
  { to: '/ai', icon: Brain, label: 'AI Predittiva' },
  { to: '/fedelta', icon: Star, label: 'Fedeltà' },
  { to: '/marketing', icon: Megaphone, label: 'Marketing' },
  { to: '/pagamenti', icon: CreditCard, label: 'Pagamenti' },
  { to: '/report', icon: FileText, label: 'Report', exact: true },
  { to: '/report/fiscal', icon: Scale, label: 'Report Fiscal', exact: true },
  { to: '/personale', icon: UserCog, label: 'Personale' },
  { to: '/magazzino', icon: Package, label: 'Magazzino' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/impostazioni', icon: Settings, label: 'Impostazioni' },
]

const externalLinks = [
  { href: '/cucina', icon: ChefHat, label: 'Schermo Cucina' },
]

export default function Sidebar() {
  const location = useLocation()
  const { restaurant } = useAuth()
  const theme = getTenantTheme(restaurant?.colorTheme)

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
      {/* Logo tenant */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          {restaurant?.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt={restaurant.name}
              className="w-10 h-10 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: theme.color }}
            >
              <ChefHat className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{restaurant?.name || 'Ristorante'}</p>
            <p className="text-xs text-slate-400">Super App SaaS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                  style={isActive ? { backgroundColor: theme.color } : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Link esterni */}
      <div className="px-3 pb-2 border-t border-slate-700 pt-3">
        {externalLinks.map(link => {
          const Icon = link.icon
          return (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
            >
              <Icon className="w-5 h-5 shrink-0" />
              {link.label}
              <span className="ml-auto text-xs opacity-50">↗</span>
            </a>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">Multi-Tenant · v2.0</p>
      </div>
    </aside>
  )
}
