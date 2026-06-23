/** Badge CRM — palette dark premium (leggibile su navy) */
const TAG_STYLES: Record<string, string> = {
  VIP: 'bg-aura-gold/15 text-aura-gold border-aura-gold/30',
  Celiaco: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
  'Vino Rosso': 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  Vegan: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  Vegetariano: 'bg-green-500/10 text-green-400 border-green-500/25',
  Allergico: 'bg-red-500/10 text-red-400 border-red-500/25',
}

const DEFAULT_TAG_STYLE = 'bg-navy-surface text-fumo border-white/[0.08]'

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
