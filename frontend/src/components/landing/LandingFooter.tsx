import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'

import { formatIssuerFooterLine } from '../../config/fiscal'

const CONTACT_EMAIL = 'elenatrambusti2024@gmail.com'

export default function LandingFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="relative border-t border-white/5 bg-[#050608] px-4 py-12 sm:px-6 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-full max-w-2xl h-32 bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />
      
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between z-10">
        <div>
          <p className="font-display text-lg font-bold text-white tracking-wide">{BRAND.name}</p>
          <p className="mt-1.5 max-w-sm text-sm text-slate-400">{t('landing.footer.tagline')}</p>
          <p className="mt-4 text-xs text-slate-500">
            {t('landing.footer.rights', { year, brand: BRAND.name })}
          </p>
          <p className="mt-2 text-[10px] text-slate-600 font-medium uppercase tracking-wider">
            {formatIssuerFooterLine()}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-400">
          <Link to="/privacy" className="hover:text-amber-400 transition-colors">
            {t('landing.footer.privacy')}
          </Link>
          <Link to="/termini" className="hover:text-amber-400 transition-colors">
            {t('landing.footer.terms')}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-amber-400 transition-colors">
            {t('landing.footer.contact')}
          </a>
        </nav>
      </div>
    </footer>
  )
}
