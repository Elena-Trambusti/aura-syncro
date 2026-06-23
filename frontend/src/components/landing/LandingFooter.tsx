import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'

import { formatIssuerFooterLine } from '../../config/fiscal'

const CONTACT_EMAIL = 'elenatrambusti2024@gmail.com'

export default function LandingFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-slate-900">{BRAND.name}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{t('landing.footer.tagline')}</p>
          <p className="mt-3 text-xs text-slate-400">
            {t('landing.footer.rights', { year, brand: BRAND.name })}
          </p>
          <p className="mt-2 text-xs text-slate-500 font-medium">
            {formatIssuerFooterLine()}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
          <Link to="/privacy" className="hover:text-amber-700 transition-colors">
            {t('landing.footer.privacy')}
          </Link>
          <Link to="/termini" className="hover:text-amber-700 transition-colors">
            {t('landing.footer.terms')}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-amber-700 transition-colors">
            {t('landing.footer.contact')}
          </a>
        </nav>
      </div>
    </footer>
  )
}
