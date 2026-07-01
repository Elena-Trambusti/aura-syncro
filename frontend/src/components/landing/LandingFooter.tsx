import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Instagram, Linkedin, Mail } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { formatIssuerFooterLine } from '../../config/fiscal'
import { LEGAL_ENTITY, LEGAL_URLS } from '../../config/legal'
import { SITE_SOCIAL } from '../../lib/siteUrl'
import { LandingSectionDecor } from './landingLuxury'

export default function LandingFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer
      className="relative overflow-hidden border-t border-[#D4AF37]/10 px-6 py-14 sm:px-8"
      itemScope
      itemType="https://schema.org/Organization"
    >
      <meta itemProp="name" content={BRAND.name} />
      <link itemProp="url" href="https://www.aurasyncro.com/" />
      <LandingSectionDecor />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-xl font-medium tracking-tight text-[#F0E6D2]">{BRAND.name}</p>
          <p className="mt-2 max-w-sm text-sm font-light leading-relaxed lux-text-soft">
            {t('landing.footer.tagline')}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href={`mailto:${LEGAL_ENTITY.email}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/20 text-[#E8C872] transition-colors hover:border-[#D4AF37]/45 hover:bg-[#D4AF37]/10"
              aria-label={t('landing.footer.email', { defaultValue: 'Email' })}
              itemProp="email"
            >
              <Mail className="h-4 w-4" />
            </a>
            {SITE_SOCIAL.linkedIn ? (
              <a
                href={SITE_SOCIAL.linkedIn}
                rel="me noopener noreferrer"
                target="_blank"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/20 text-[#E8C872] transition-colors hover:border-[#D4AF37]/45 hover:bg-[#D4AF37]/10"
                aria-label="LinkedIn"
                itemProp="sameAs"
              >
                <Linkedin className="h-4 w-4" />
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
                <Instagram className="h-4 w-4" />
              </a>
            ) : null}
          </div>
          <p className="mt-5 text-xs font-light lux-text-muted">
            {t('landing.footer.rights', { year, brand: BRAND.name })}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] lux-text-faint">
            {formatIssuerFooterLine()}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-light lux-text-soft">
          <Link to={LEGAL_URLS.privacy} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.privacy')}
          </Link>
          <Link to={LEGAL_URLS.terms} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.terms')}
          </Link>
          <Link to={LEGAL_URLS.cookie} className="transition-colors hover:text-[#E8C872]">
            Cookie
          </Link>
          <Link to={LEGAL_URLS.dpa} className="transition-colors hover:text-[#E8C872]">
            DPA
          </Link>
          <Link to={LEGAL_URLS.guestPrivacy} className="transition-colors hover:text-[#E8C872]">
            Ospiti
          </Link>
          <Link to={LEGAL_URLS.contact} className="transition-colors hover:text-[#E8C872]">
            {t('landing.footer.contact')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
