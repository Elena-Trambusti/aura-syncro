/** Classi UI condivise — Aura Syncro SaaS Professional theme */
export const ui = {
  pageTitle: 'text-2xl font-bold text-slate-900 tracking-tight',
  pageSubtitle: 'text-sm text-slate-600 mt-1',
  card: 'saas-card-lg',
  cardSm: 'saas-card',
  cardHover: 'saas-card-hover',
  cardSolid: 'saas-card-lg',
  panel: 'bg-white border-b border-slate-200 shadow-sm',
  modalOverlay: 'saas-overlay flex items-center justify-center p-4',
  modal: 'saas-modal p-6 w-full max-w-lg',
  modalTitle: 'text-lg font-bold text-slate-900 mb-5',
  label: 'block text-sm font-medium text-slate-700 mb-1.5',
  input:
    'saas-input w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500',
  select:
    'saas-input w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500',
  textarea:
    'saas-input w-full px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none',
  chip: 'saas-chip rounded-lg',
  chipInactive: 'saas-chip text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors',
  tabActive: 'bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm rounded-lg',
  tabInactive: 'saas-chip text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg',
  dropdown: 'saas-dropdown',
  tableHead: 'text-xs font-semibold uppercase tracking-wider text-slate-500',
  tableRow: 'border-b border-slate-200 hover:bg-slate-50 transition-colors',
  tableHeadBg: 'saas-table-head',
  badgeSuccess: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  badgeMuted: 'bg-slate-100 text-slate-600 border border-slate-200',
  btnPrimary: 'saas-btn-primary',
  pageHeader: 'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
  tableWrap: 'overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0',
  filterRow: 'flex gap-2 flex-wrap',
} as const
