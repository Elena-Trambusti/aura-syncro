import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLogo from '../brand/BrandLogo'
import { BRAND } from '../../lib/brand'
import LanguageSwitcher from '../layout/LanguageSwitcher'
import { useAuth } from '../../contexts/AuthContext'
import { isDemoUserEmail } from '../../lib/demoAccounts'
import RegisterLink from './RegisterLink'

export default function LandingNav() {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-black/40 pt-[env(safe-area-inset-top,0px)] shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-md md:backdrop-blur-2xl">
      {/* Premium glowing top line */}
      <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-aura-gold/50 to-transparent" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandLogo size="sm" className="mx-0 shadow-sm" priority />
          <span className="text-sm font-bold text-slate-100 sm:text-base">{BRAND.name}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
          <a href="#features" className="hover:text-[#D4AF37] transition-colors">
            {t('landing.nav.features')}
          </a>
          <a href="#pricing" className="hover:text-[#D4AF37] transition-colors">
            {t('landing.nav.pricing')}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          {isLoading ? (
            <div className="hidden sm:block h-9 w-32 animate-pulse rounded-lg bg-white/5" />
          ) : user && !isDemoUserEmail(user.email) ? (
            <Link
              to="/dashboard"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-amber-500 hover:text-amber-400 hover:bg-white/5 sm:inline-block transition-colors"
            >
              {t('landing.nav.dashboard', { defaultValue: 'Vai alla Dashboard' })}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 sm:inline-block transition-colors"
              >
                {t('landing.nav.login')}
              </Link>
              <RegisterLink
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 sm:inline-block transition-colors"
              >
                {t('landing.nav.register', { defaultValue: 'Registrati' })}
              </RegisterLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
