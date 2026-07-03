import { BRAND_LOGO_PATH, BRAND_LOGO_VERSION } from './brand'
import { LEGAL_ENTITY } from '../config/legal'
import { SITE_ORIGIN, SITE_SOCIAL } from './siteUrl'

const STRUCTURED_DATA_SCRIPT_ID = 'aura-landing-ld-json'

export function injectLandingStructuredData(
  lang: string,
  pageTitle: string,
  pageDescription: string,
  canonicalPath = '/',
) {
  document.getElementById(STRUCTURED_DATA_SCRIPT_ID)?.remove()

  const sameAs = [SITE_SOCIAL.linkedIn, SITE_SOCIAL.instagram].filter(
    (url): url is string => Boolean(url),
  )

  const pageUrl = `${SITE_ORIGIN}${canonicalPath === '/' ? '/' : canonicalPath}`

  const script = document.createElement('script')
  script.id = STRUCTURED_DATA_SCRIPT_ID
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: 'Aura Syncro',
        url: `${SITE_ORIGIN}/`,
        logo: `${SITE_ORIGIN}${BRAND_LOGO_PATH}?v=${BRAND_LOGO_VERSION}`,
        email: LEGAL_ENTITY.email,
        ...(sameAs.length > 0 ? { sameAs } : {}),
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          email: LEGAL_ENTITY.email,
          availableLanguage: ['Italian', 'English', 'Spanish', 'French', 'German'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: `${SITE_ORIGIN}/`,
        name: 'Aura Syncro',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        inLanguage: lang,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_ORIGIN}/#software`,
        name: 'Aura Syncro',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, Progressive Web App',
        url: `${SITE_ORIGIN}/`,
        description: pageDescription,
        offers: {
          '@type': 'Offer',
          price: '199.00',
          priceCurrency: 'EUR',
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: pageTitle,
        description: pageDescription,
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        about: { '@id': `${SITE_ORIGIN}/#software` },
      },
    ],
  })
  document.head.appendChild(script)

  return () => {
    document.getElementById(STRUCTURED_DATA_SCRIPT_ID)?.remove()
  }
}
