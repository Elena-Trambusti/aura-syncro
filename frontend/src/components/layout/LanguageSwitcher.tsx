import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { localePathForSwitch, resolveActiveLocale } from '../../i18n/localeUtils'
import { applyLocale, CANARIAS_LOCALE, normalizeLocaleCode, type SupportedLocale } from '../../i18n/bootstrap'

const LANGUAGES = [
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: CANARIAS_LOCALE, name: 'Español (Canarias)' },
] as const

const MENU_MIN_WIDTH = 168
const OVERLAY_Z = 99998
const MENU_Z = 99999

interface LanguageSwitcherProps {
  prominent?: boolean
  /** Nasconde il nome lingua fino a lg — utile nella topbar stretta */
  compact?: boolean
}

export default function LanguageSwitcher({ prominent = false, compact = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; minWidth: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const activeCode = resolveActiveLocale(location.pathname, i18n.language)
  const current =
    LANGUAGES.find(lang => lang.code === activeCode) ??
    LANGUAGES.find(lang => lang.code === normalizeLocaleCode(i18n.language)) ??
    LANGUAGES[0]

  const updateMenuPosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, MENU_MIN_WIDTH),
    })
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const changeLanguage = (code: string) => {
    const locale = normalizeLocaleCode(code) ?? code
    void applyLocale(locale).then(() => {
      const nextPath = localePathForSwitch(locale as SupportedLocale, location.pathname)
      if (nextPath && nextPath !== location.pathname) {
        navigate(nextPath, { replace: true })
      }
      close()
    })
  }

  useEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const portal =
    open && menuPos
      ? createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-0 bg-black/20"
              style={{ zIndex: OVERLAY_Z }}
              onClick={close}
            />
            <ul
              ref={menuRef}
              role="listbox"
              aria-label={t('common.selectLanguage')}
              style={{
                position: 'fixed',
                top: menuPos.top,
                right: menuPos.right,
                minWidth: menuPos.minWidth,
                zIndex: MENU_Z,
              }}
              className="py-1 saas-dropdown"
            >
              {LANGUAGES.map(lang => {
                const selected = lang.code === current.code
                return (
                  <li key={lang.code} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => changeLanguage(lang.code)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-left transition-colors',
                        selected
                          ? 'text-aura-gold bg-aura-gold/10'
                          : 'text-fumo hover:bg-white/[0.05] hover:text-pietra',
                      )}
                    >
                      <span>{lang.name}</span>
                      {selected && <Check className="w-4 h-4 shrink-0 text-aura-gold" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'relative flex items-center gap-1.5 font-medium border rounded-lg transition-colors',
          open && 'z-[100000]',
          prominent
            ? 'px-3 py-2 text-sm text-fumo saas-chip hover:bg-white/[0.05] hover:text-pietra'
            : 'px-2.5 py-1.5 text-xs text-fumo saas-chip hover:bg-white/[0.05] hover:text-pietra',
        )}
        aria-label={t('common.selectLanguage')}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t('common.selectLanguage')}
      >
        <Globe className={cn('shrink-0', prominent ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
        <span className={cn(compact ? 'hidden lg:inline' : 'hidden sm:inline')}>{current.name}</span>
        <ChevronDown className={cn('shrink-0 opacity-60 transition-transform', prominent ? 'w-3.5 h-3.5' : 'w-3 h-3', open && 'rotate-180')} />
      </button>
      {portal}
    </>
  )
}
