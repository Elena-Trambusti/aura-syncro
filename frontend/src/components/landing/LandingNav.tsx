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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#D4AF37]/10 bg-[#020202]/95 pt-[env(safe-area-inset-top,0px)] shadow-[0_4px_30px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/45 to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandLogo size="sm" className="mx-0 shadow-sm" priority />
          <span className="font-display text-sm font-medium tracking-tight text-[#F0E6D2] sm:text-base">{BRAND.name}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium lux-text-soft md:flex">
          <a href="#features" className="transition-colors hover:text-[#E8C872]">
            {t('landing.nav.features')}
          </a>
          <a href="#pricing" className="transition-colors hover:text-[#E8C872]">
            {t('landing.nav.pricing')}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          {isLoading ? (
            <div className="hidden h-9 w-32 animate-pulse rounded-lg bg-white/5 sm:block" />
          ) : user && !isDemoUserEmail(user.email) ? (
            <Link
              to="/dashboard"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#E8C872] transition-colors hover:bg-[#D4AF37]/5 hover:text-[#F0E6D2] sm:inline-block"
            >
              {t('landing.nav.dashboard', { defaultValue: 'Vai alla Dashboard' })}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium lux-text-soft transition-colors hover:bg-[#D4AF37]/5 hover:text-[#E8C872] sm:inline-block"
              >
                {t('landing.nav.login')}
              </Link>
              <RegisterLink
                className="hidden rounded-lg px-3 py-2 text-sm font-medium lux-text-soft transition-colors hover:bg-[#D4AF37]/5 hover:text-[#E8C872] sm:inline-block"
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
