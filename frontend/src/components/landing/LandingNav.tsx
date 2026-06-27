import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLogo from '../brand/BrandLogo'
import { BRAND } from '../../lib/brand'
import LanguageSwitcher from '../layout/LanguageSwitcher'
import { useAuth } from '../../contexts/AuthContext'

export default function LandingNav() {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5)] pt-[env(safe-area-inset-top,0px)]">
      {/* Premium glowing top line */}
      <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-aura-gold/50 to-transparent" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandLogo size="sm" className="mx-0 shadow-sm" />
          <span className="text-sm font-bold text-white sm:text-base">{BRAND.name}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-white/80 md:flex">
          <a href="#features" className="hover:text-amber-500 transition-colors">
            {t('landing.nav.features')}
          </a>
          <a href="#pricing" className="hover:text-amber-500 transition-colors">
            {t('landing.nav.pricing')}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          {isLoading ? (
            <div className="hidden sm:block h-9 w-32 animate-pulse rounded-lg bg-white/5" />
          ) : user ? (
            <Link
              to="/dashboard"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-amber-500 hover:text-amber-400 hover:bg-white/5 sm:inline-block transition-colors"
            >
              Vai alla Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-amber-500 hover:bg-white/5 sm:inline-block transition-colors"
              >
                {t('landing.nav.login')}
              </Link>
              <Link
                to="/register"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-amber-500 hover:bg-white/5 sm:inline-block transition-colors"
              >
                {t('landing.nav.register', { defaultValue: 'Registrati' })}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
