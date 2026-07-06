import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { cn } from '../../lib/utils'
import { applyLocale, CANARIAS_LOCALE, normalizeLocaleCode } from '../../i18n/bootstrap'

const PUBLIC_LANGUAGES = [
  { code: 'it', label: 'IT', name: 'Italiano' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: CANARIAS_LOCALE, label: 'ES-CN', name: 'Español (Canarias)' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
] as const

const MENU_MIN_WIDTH = 200
const OVERLAY_Z = 99998
const MENU_Z = 99999

interface PublicLanguageSwitcherProps {
  className?: string
}

/** Switcher lingua pubblico — dropdown compatto luxury (menu QR, prenotazioni). */
export default function PublicLanguageSwitcher({ className }: PublicLanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; minWidth: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const currentLang = (normalizeLocaleCode(i18n.language) ?? i18n.language) || 'it'
  const currentCode = PUBLIC_LANGUAGES.some(l => l.code === currentLang)
    ? currentLang
    : (currentLang.split('-')[0] ?? 'it')
  const current = PUBLIC_LANGUAGES.find(l => l.code === currentCode) ?? PUBLIC_LANGUAGES[0]

  const close = useCallback(() => setOpen(false), [])

  const changeLanguage = (code: string) => {
    void applyLocale(code)
    close()
  }

  const updateMenuPosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
      minWidth: Math.max(rect.width, MENU_MIN_WIDTH),
    })
  }, [])

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

  const portal =
    open && menuPos
      ? createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
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
              className="overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-neutral-950/95 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55),0_0_24px_rgba(212,175,55,0.08)] backdrop-blur-xl"
            >
              {PUBLIC_LANGUAGES.map(lang => {
                const selected = lang.code === current.code
                return (
                  <li key={lang.code} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => changeLanguage(lang.code)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors',
                        selected
                          ? 'bg-[#D4AF37]/12 font-semibold text-[#E8C872]'
                          : 'font-medium text-slate-300 hover:bg-white/[0.04] hover:text-[#F0E6D2]',
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-10 text-[10px] font-bold uppercase tracking-wider text-[#C5A059]/90">
                          {lang.label}
                        </span>
                        <span>{lang.name}</span>
                      </span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-[#E8C872]" /> : null}
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
          'inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/28 bg-neutral-950/75 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#E8C872] shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-[#D4AF37]/45 hover:bg-neutral-950/90 sm:px-3.5 sm:text-sm',
          open && 'border-[#D4AF37]/50 bg-neutral-950/90',
          className,
        )}
        aria-label={t('common.selectLanguage')}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={current.name}
      >
        <Globe className="h-3.5 w-3.5 shrink-0 text-[#C5A059] sm:h-4 sm:w-4" aria-hidden />
        <span>{current.label}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-[#C5A059]/80 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {portal}
    </>
  )
}
