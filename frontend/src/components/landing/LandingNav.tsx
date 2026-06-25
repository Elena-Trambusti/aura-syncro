import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLogo from '../brand/BrandLogo'
import { BRAND } from '../../lib/brand'
import LanguageSwitcher from '../layout/LanguageSwitcher'

export default function LandingNav() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur-md">
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
        </div>
      </div>
    </header>
  )
}
