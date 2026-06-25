import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLogo from '../brand/BrandLogo'
import { BRAND } from '../../lib/brand'
import LanguageSwitcher from '../layout/LanguageSwitcher'

export default function LandingNav() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandLogo size="sm" className="mx-0 shadow-sm" />
          <span className="text-sm font-bold text-slate-900 sm:text-base">{BRAND.name}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="hover:text-slate-900 transition-colors">
            {t('landing.nav.features')}
          </a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors">
            {t('landing.nav.pricing')}
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            to="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-block"
          >
            {t('landing.nav.login')}
          </Link>
          <Link
            to="/register"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-block"
          >
            {t('landing.nav.register', { defaultValue: 'Registrati' })}
          </Link>
        </div>
      </div>
    </header>
  )
}
