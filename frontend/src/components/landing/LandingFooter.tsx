import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import BrandLogo from '../brand/BrandLogo'
import { formatIssuerFooterLine } from '../../config/fiscal'
import { LEGAL_URLS } from '../../config/legal'
import { SITE_SOCIAL } from '../../lib/siteUrl'

export default function LandingFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer
      className="relative overflow-hidden border-t border-[#D4AF37]/5 bg-[#020201]/96 px-6 py-14 sm:px-8"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <meta itemProp="name" content={BRAND.name} />
      <link itemProp="url" href="https://www.aurasyncro.com/" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/12 to-transparent" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandLogo size="sm" className="mx-0" />
            <p className="lux-heading font-display text-xl font-medium tracking-tight drop-shadow-sm">
              {BRAND.name}
            </p>
          </div>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed text-[#F0E6D2]">
            {t('landing.footer.tagline')}
          </p>
          <div className="mt-4 flex items-center gap-3">

            {SITE_SOCIAL.linkedIn ? (
              <a
                href={SITE_SOCIAL.linkedIn}
                rel="me noopener noreferrer"
                target="_blank"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/20 text-[#E8C872] transition-colors hover:border-[#D4AF37]/45 hover:bg-[#D4AF37]/10"
                aria-label="LinkedIn"
                itemProp="sameAs"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            {SITE_SOCIAL.instagram ? (
              <a
                href={SITE_SOCIAL.instagram}
                rel="me noopener noreferrer"
                target="_blank"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/20 text-[#E8C872] transition-colors hover:border-[#D4AF37]/45 hover:bg-[#D4AF37]/10"
                aria-label="Instagram"
                itemProp="sameAs"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
          <p className="mt-5 text-xs font-light text-[#F0E6D2]">
            {t('landing.footer.rights', { year, brand: BRAND.name })}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#F0E6D2]/80">
            {formatIssuerFooterLine()}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-light text-[#F0E6D2]">
          <Link to={LEGAL_URLS.privacy} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.privacy')}
          </Link>
          <Link to={LEGAL_URLS.terms} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.terms')}
          </Link>
          <Link to={LEGAL_URLS.cookie} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.cookie')}
          </Link>
          <Link to={LEGAL_URLS.dpa} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.dpa')}
          </Link>
          <Link to={LEGAL_URLS.guestPrivacy} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.guests')}
          </Link>
          <Link to={LEGAL_URLS.contact} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.contact')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
