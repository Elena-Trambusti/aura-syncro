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
    <header className="landing-nav fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top,0px)]">
      <div className="landing-nav__line absolute inset-x-0 bottom-0" />
      <div className="landing-nav__inner mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3 lg:px-8">
        <Link
          to="/"
          className="relative z-10 flex shrink-0 items-center gap-2 sm:gap-2.5"
        >
          <BrandLogo size="sm" className="mx-0 shrink-0 shadow-sm" priority />
          <span className="hidden min-[380px]:inline truncate font-display text-sm font-normal tracking-[0.04em] text-[#F5EDE0] sm:text-base">
            {BRAND.name}
          </span>
        </Link>
        <div className="relative z-10 flex shrink-0 items-center gap-1 sm:gap-3">
          <LanguageSwitcher compact />
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded-lg bg-white/5 sm:h-9 sm:w-32" />
          ) : user && !isDemoUserEmail(user.email) ? (
            <Link
              to="/dashboard"
              className="shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-[#E8C872] transition-colors hover:bg-[#D4AF37]/5 hover:text-[#F0E6D2] sm:px-3 sm:py-2 sm:text-sm"
            >
              {t('landing.nav.dashboard', { defaultValue: 'Dashboard' })}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-[#E8C872] transition-colors hover:bg-[#D4AF37]/5 hover:text-[#F0E6D2] sm:px-3 sm:py-2 sm:text-sm"
              >
                {t('landing.nav.login')}
              </Link>
              <RegisterLink className="shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium text-[#E8C872] transition-colors hover:bg-[#D4AF37]/5 hover:text-[#F0E6D2] sm:px-3 sm:py-2 sm:text-sm">
                <span className="max-[340px]:hidden">{t('landing.nav.register')}</span>
                <span className="hidden max-[340px]:inline">Reg.</span>
              </RegisterLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
