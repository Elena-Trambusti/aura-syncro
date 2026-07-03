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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="relative z-10 flex min-w-0 max-w-[38%] items-center gap-2 sm:max-w-none sm:gap-2.5"
        >
          <BrandLogo size="sm" className="mx-0 shrink-0 shadow-sm" priority />
          <span className="truncate font-display text-sm font-medium tracking-tight text-[#F0E6D2] sm:text-base">
            {BRAND.name}
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#F0E6D2] md:flex">
          {/* Nav links rimossi per focalizzare sulla CTA */}
        </nav>
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-3">
          <LanguageSwitcher compact />
          {isLoading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-white/5 sm:h-9 sm:w-32" />
          ) : user && !isDemoUserEmail(user.email) ? (
            <Link
              to="/dashboard"
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#E8C872] transition-colors hover:bg-[#D4AF37]/5 hover:text-[#F0E6D2] sm:px-3 sm:py-2 sm:text-sm"
            >
              {t('landing.nav.dashboard', { defaultValue: 'Dashboard' })}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#E8C872] transition-colors hover:bg-[#D4AF37]/5 hover:text-[#F0E6D2] sm:px-3 sm:py-2 sm:text-sm"
              >
                {t('landing.nav.login')}
              </Link>
              <RegisterLink
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-[#E8C872] transition-colors hover:bg-[#D4AF37]/5 hover:text-[#F0E6D2] sm:px-3 sm:py-2 sm:text-sm"
              >
                {t('landing.nav.register')}
              </RegisterLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
