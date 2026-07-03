import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, ArrowRight, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/utils'
import { COMMAND_ROUTES } from '../../lib/commandRoutes'
import { useRole } from '../../hooks/useRole'
import { usePlanTier } from '../../hooks/usePlanTier'
import { useAccessTier } from '../../hooks/useAccessTier'
import { AuraDialog } from '../ui/AuraDialog'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const { canAccessAdminNav, canManageStaff, can } = useRole()
  const { hasProPlan } = usePlanTier()
  const { tier } = useAccessTier()

  const routes = useMemo(() => {
    return COMMAND_ROUTES.filter(route => {
      if (route.adminOnly && !canAccessAdminNav()) return false
      if (route.staffManagersOnly && !canManageStaff()) return false
      if (route.permission && !can(route.permission)) return false
      if (route.proOnly && !hasProPlan && tier === 'operational') return false
      return true
    })
  }, [canAccessAdminNav, canManageStaff, can, hasProPlan, tier])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return routes
    return routes.filter(route => {
      const label = t(route.labelKey).toLowerCase()
      return label.includes(q) || route.keywords.some(k => k.includes(q) || q.includes(k))
    })
  }, [routes, query, t])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const select = useCallback((index: number) => {
    const route = filtered[index]
    if (!route) return
    onClose()
    if (route.external) {
      window.open(route.to, '_blank', 'noopener,noreferrer')
    } else {
      navigate(route.to)
    }
  }, [filtered, navigate, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        select(activeIndex)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered.length, activeIndex, select, onClose])

  if (!open) return null

  return (
    <AuraDialog
      onClose={onClose}
      hideClose
      maxWidth="lg"
      a11yTitle={t('commandPalette.title', { defaultValue: 'Navigazione rapida' })}
      a11yDescription={t('commandPalette.placeholder', { defaultValue: 'Cerca sezioni, tavoli, ordini' })}
      className="aura-command-palette !top-[12vh] bottom-auto max-h-[min(70dvh,480px)] !translate-x-[-50%] !translate-y-0 overflow-hidden p-0"
    >
      <div
        className="w-full"
        role="dialog"
        aria-label={t('commandPalette.title', { defaultValue: 'Navigazione rapida' })}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-fumo" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('commandPalette.placeholder', { defaultValue: 'Cerca sezioni, tavoli, ordini…' })}
            className="flex-1 bg-transparent text-sm text-pietra placeholder:text-fumo outline-none"
          />
          <kbd className="aura-kbd hidden sm:inline">Esc</kbd>
        </div>

        <ul className="max-h-[min(50dvh,360px)] overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-fumo">
              {t('commandPalette.noResults', { defaultValue: 'Nessun risultato' })}
            </li>
          ) : (
            filtered.map((route, i) => (
              <li key={route.to}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => select(i)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    i === activeIndex ? 'bg-aura-gold/10 text-pietra' : 'text-fumo hover:bg-white/[0.04]',
                  )}
                >
                  <span className="flex-1 font-medium">{t(route.labelKey)}</span>
                  {route.external ? (
                    <ExternalLink className="h-3.5 w-3.5 opacity-50" aria-hidden />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="hidden border-t border-white/[0.06] px-4 py-2 text-[10px] text-fumo/60 sm:flex sm:items-center sm:gap-3">
          <span><kbd className="aura-kbd">↑↓</kbd> {t('commandPalette.navigate', { defaultValue: 'naviga' })}</span>
          <span><kbd className="aura-kbd">↵</kbd> {t('commandPalette.open', { defaultValue: 'apri' })}</span>
        </div>
      </div>
    </AuraDialog>
  )
}
