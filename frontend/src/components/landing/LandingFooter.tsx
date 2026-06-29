import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND } from '../../lib/brand'
import { formatIssuerFooterLine } from '../../config/fiscal'
import { LEGAL_URLS } from '../../config/legal'


export default function LandingFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="relative border-t border-white/[0.02] bg-transparent px-4 py-12 sm:px-6 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[1px] bg-gradient-to-r from-transparent via-aura-gold/60 to-transparent shadow-[0_0_20px_rgba(212,175,55,0.5)]" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-full max-w-2xl h-32 bg-aura-gold/10 blur-[100px] pointer-events-none rounded-full" />
      
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between z-10">
        <div>
          <p className="font-display text-lg font-bold text-slate-100 tracking-wide">{BRAND.name}</p>
          <p className="mt-1.5 max-w-sm text-sm text-slate-300">{t('landing.footer.tagline')}</p>
          <p className="mt-4 text-xs text-slate-500">
            {t('landing.footer.rights', { year, brand: BRAND.name })}
          </p>
          <p className="mt-2 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            {formatIssuerFooterLine()}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-300">
          <Link to={LEGAL_URLS.privacy} className="hover:text-white transition-colors">
            {t('landing.footer.privacy')}
          </Link>
          <Link to={LEGAL_URLS.terms} className="hover:text-white transition-colors">
            {t('landing.footer.terms')}
          </Link>
          <Link to={LEGAL_URLS.cookie} className="hover:text-white transition-colors">
            Cookie
          </Link>
          <Link to={LEGAL_URLS.dpa} className="hover:text-white transition-colors">
            DPA
          </Link>
          <Link to={LEGAL_URLS.guestPrivacy} className="hover:text-white transition-colors">
            Ospiti
          </Link>
          <Link to={LEGAL_URLS.contact} className="hover:text-white transition-colors">
            {t('landing.footer.contact')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
