/** Classi UI condivise — Aura Syncro glassmorphism theme */
export const ui = {
  pageTitle: 'text-2xl font-bold text-stone-100 tracking-tight',
  pageSubtitle: 'text-sm text-stone-400 mt-1',
  /** Contenitore card standard */
  card: 'glass-card-lg shadow-lg shadow-black/20',
  cardSm: 'glass-card shadow-lg shadow-black/20',
  cardHover: 'glass-card-hover',
  cardSolid: 'glass-card-lg',
  /** Pannelli layout (sidebar, header) */
  panel: 'glass-panel',
  /** Modali */
  modalOverlay: 'glass-overlay flex items-center justify-center p-4',
  modal: 'glass-modal p-6 w-full max-w-lg',
  modalTitle: 'text-lg font-bold text-stone-100 mb-5',
  /** Form */
  label: 'block text-sm font-medium text-stone-300 mb-1.5',
  input:
    'glass-input w-full px-3 py-2.5 rounded-xl text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/35 focus:border-amber-700/40',
  select:
    'glass-input w-full px-3 py-2.5 rounded-xl text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35',
  textarea:
    'glass-input w-full px-3 py-2.5 rounded-xl text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/35 resize-none',
  /** Tab / filtri inattivi */
  chip: 'glass-chip rounded-lg',
  chipInactive:
    'glass-chip text-stone-300 hover:bg-white/[0.06] hover:text-stone-200 transition-colors',
  tabActive: 'bg-amber-600/90 text-stone-950 font-semibold shadow-sm',
  tabInactive: 'glass-chip text-stone-400 hover:bg-white/[0.06] hover:text-stone-200',
  /** Dropdown / menu flottanti */
  dropdown: 'glass-dropdown',
  /** Tabelle */
  tableHead: 'text-xs font-semibold uppercase tracking-wider text-stone-500',
  tableRow: 'border-b border-white/5 hover:bg-white/[0.03] transition-colors',
  tableHeadBg: 'glass-table-head',
  badgeSuccess: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40',
  badgeMuted: 'bg-stone-800/60 text-stone-400 border border-stone-700/40',
  pageHeader: 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
  tableWrap: 'overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0',
  filterRow: 'flex gap-2 flex-wrap',
} as const
