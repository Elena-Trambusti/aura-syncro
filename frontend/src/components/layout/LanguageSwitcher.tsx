import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const LANGUAGES = [
  { code: 'it', label: 'IT', flag: '🇮🇹' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'fr', label: 'FR', flag: '🇫🇷' },
  { code: 'de', label: 'DE', flag: '🇩🇪' },
] as const

const STORAGE_KEY = 'aura-lang'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const current =
    LANGUAGES.find(lang => lang.code === i18n.language?.split('-')[0]) ?? LANGUAGES[0]

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem(STORAGE_KEY, code)
    setOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-stone-400 border border-stone-700/60 rounded-lg hover:bg-stone-800/50 hover:text-stone-200 transition-colors"
        aria-label={t('common.selectLanguage')}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={cn('w-3 h-3 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('common.selectLanguage')}
          className="absolute right-0 top-full mt-1 z-50 min-w-[7rem] py-1 rounded-lg border border-stone-700/80 bg-stone-900 shadow-xl"
        >
          {LANGUAGES.map(lang => (
            <li key={lang.code} role="option" aria-selected={lang.code === current.code}>
              <button
                type="button"
                onClick={() => changeLanguage(lang.code)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors',
                  lang.code === current.code
                    ? 'text-amber-400 bg-stone-800/80'
                    : 'text-stone-300 hover:bg-stone-800/60 hover:text-stone-100',
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
