/** Classi UI condivise — Aura Syncro professional dark theme */
export const ui = {
  pageTitle: 'text-2xl font-bold text-stone-100 tracking-tight',
  pageSubtitle: 'text-sm text-stone-400 mt-1',
  card: 'rounded-2xl border border-stone-700/45 bg-stone-900/50 backdrop-blur-sm shadow-lg shadow-black/10',
  cardSolid: 'rounded-2xl border border-stone-700/45 bg-stone-900/65',
  cardHover: 'hover:border-stone-600/50 hover:bg-stone-900/70 transition-colors',
  tableHead: 'text-xs font-semibold uppercase tracking-wider text-stone-500',
  tableRow: 'border-b border-stone-800/50 hover:bg-stone-800/25 transition-colors',
  label: 'block text-sm font-medium text-stone-300 mb-1.5',
  input:
    'w-full px-3 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-700/40',
  select:
    'w-full px-3 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35',
  textarea:
    'w-full px-3 py-2.5 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/35 resize-none',
  modalOverlay: 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4',
  modal: 'rounded-2xl border border-stone-700/50 bg-stone-900 p-6 w-full shadow-2xl shadow-black/30',
  modalTitle: 'text-lg font-bold text-stone-100 mb-5',
  tabActive: 'bg-amber-600/90 text-stone-950 font-semibold shadow-sm',
  tabInactive:
    'bg-stone-800/50 text-stone-400 border border-stone-700/40 hover:bg-stone-800 hover:text-stone-200',
  badgeSuccess: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
  badgeMuted: 'bg-stone-800/60 text-stone-400 border border-stone-700/40',
} as const
