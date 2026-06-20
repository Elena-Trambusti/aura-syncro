/** Pastel badge styles for CRM customer tags */
const TAG_STYLES: Record<string, string> = {
  VIP: 'bg-amber-50 text-amber-800 border-amber-200',
  Celiaco: 'bg-orange-50 text-orange-800 border-orange-200',
  'Vino Rosso': 'bg-rose-50 text-rose-800 border-rose-200',
  Vegan: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Vegetariano: 'bg-green-50 text-green-800 border-green-200',
  Allergico: 'bg-red-50 text-red-800 border-red-200',
}

const DEFAULT_TAG_STYLE = 'bg-slate-100 text-slate-700 border-slate-200'

export function tagBadgeClass(tag: string): string {
  return TAG_STYLES[tag] ?? DEFAULT_TAG_STYLE
}

export function customerDisplayName(c: { firstName?: string; lastName?: string; name: string }): string {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return full || c.name
}

export function isVipCustomer(c: { tags?: string[]; totalVisits: number; totalSpent: number }): boolean {
  return c.tags?.includes('VIP') || c.totalVisits >= 10 || c.totalSpent >= 500
}
