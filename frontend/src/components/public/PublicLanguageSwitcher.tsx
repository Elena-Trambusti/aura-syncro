import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

const PUBLIC_LANGUAGES = [
  { code: 'it', label: 'IT', name: 'Italiano' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'es-cn', label: 'ES-CN', name: 'Español (Canarias)' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
] as const

const STORAGE_KEY = 'aura-lang'

interface PublicLanguageSwitcherProps {
  className?: string
}

/** Switcher lingua evidente per turisti — solo IT / ES / EN */
export default function PublicLanguageSwitcher({ className }: PublicLanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const currentLang = i18n.language || 'it'
  const current = PUBLIC_LANGUAGES.find(l => l.code === currentLang) 
    ? currentLang 
    : (currentLang.split('-')[0] ?? 'it')

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem(STORAGE_KEY, code)
  }

  return (
    <div
      className={cn('inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm', className)}
      role="group"
      aria-label={t('common.selectLanguage')}
    >
      {PUBLIC_LANGUAGES.map(lang => {
        const active = current === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => changeLanguage(lang.code)}
            title={lang.name}
            aria-pressed={active}
            className={cn(
              'min-w-[3rem] rounded-lg px-3 py-2 text-sm font-bold transition-colors',
              active
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-50',
            )}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
