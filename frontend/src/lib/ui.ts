/** Classi UI condivise — Aura Syncro Premium Dark theme */
export const ui = {
  pageTitle: 'aura-page-title',
  pageSubtitle: 'aura-page-subtitle',
  card: 'premium-card p-5 sm:p-6',
  cardSm: 'premium-card p-4',
  cardHover: 'premium-card premium-card-hover',
  cardSolid: 'premium-card p-5 sm:p-6',
  panel: 'border-b border-white/[0.06] bg-navy-mid',
  modalOverlay: 'saas-overlay flex items-end sm:items-center justify-center p-0 sm:p-4',
  modal:
    'aura-glass aura-glass--modal w-full max-w-lg max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] overflow-y-auto rounded-t-2xl sm:rounded-2xl mx-auto p-4 sm:p-6',
  modalTitle: 'text-lg font-bold text-pietra mb-5',
  label: 'block text-sm font-medium text-fumo mb-1.5',
  input:
    'saas-input w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-aura-gold/30 focus:border-aura-gold/50',
  select:
    'saas-input w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-aura-gold/30 focus:border-aura-gold/50',
  textarea:
    'saas-input w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-aura-gold/30 resize-none',
  chip: 'saas-chip rounded-lg',
  chipInactive: 'saas-chip text-fumo hover:bg-white/[0.05] hover:text-pietra transition-colors',
  tabActive: 'aura-tab-active',
  tabInactive: 'aura-tab-inactive',
  dropdown: 'saas-dropdown',
  tableHead: 'text-xs font-semibold uppercase tracking-wider text-fumo',
  tableRow: 'border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors',
  tableHeadBg: 'saas-table-head',
  badgeSuccess: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  badgeMuted: 'bg-navy-surface text-fumo border border-white/[0.08]',
  btnPrimary: 'saas-btn-primary',
  pageHeader: 'aura-page-header',
  tableWrap: 'aura-table-wrap',
  filterRow: 'aura-filter-row',
  btnGhost: 'aura-btn-ghost',
  emptyState: 'aura-empty-state',
  alertError: 'premium-alert-error',
  slideOver:
    'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/[0.08] bg-navy-elevated bg-[image:var(--aura-surface-card)] shadow-[var(--shadow-premium-xl)]',
  slideOverOverlay: 'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity',
  /** Vetro satin dark — pricing, tavoli, pannelli premium */
  glass: 'aura-glass rounded-xl',
  glassElevated: 'aura-glass aura-glass--elevated rounded-2xl',
  glassSatin: 'aura-glass aura-glass--satin rounded-2xl',
  glassModal: 'aura-glass aura-glass--modal rounded-2xl',
  lineClamp2: 'line-clamp-2',
  lineClamp3: 'line-clamp-3',
  glassDropdown: 'aura-glass-dropdown',
} as const
