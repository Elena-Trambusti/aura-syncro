import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '../lib/usePageMeta'
import { injectLandingStructuredData } from '../lib/landingStructuredData'
import { LANDING_MARBLE } from '../lib/landingAssets'
import {
  LANDING_HREFLANG_ALTERNATES,
  ogLocaleForLanguage,
} from '../lib/siteUrl'
import LandingNav from '../components/landing/LandingNav'
import LandingHero from '../components/landing/LandingHero'
import LandingBelowFold from '../components/landing/LandingBelowFold'
import { LuxuryGoldGradientDefs } from '../components/landing/landingLuxury'

export default function LandingPage() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const metaTitle = t('landing.meta.title')
  const metaDescription = t('landing.meta.description')
  const canonicalPath = pathname === '/' ? '/' : pathname

  usePageMeta(metaTitle, metaDescription, {
    canonicalPath,
    htmlLang: i18n.language,
    ogLocale: ogLocaleForLanguage(i18n.language),
    hreflangAlternates: LANDING_HREFLANG_ALTERNATES,
  })

  useEffect(() => {
    return injectLandingStructuredData(i18n.language, metaTitle, metaDescription, canonicalPath)
  }, [i18n.language, metaTitle, metaDescription, canonicalPath])

  useLayoutEffect(() => {
    document.getElementById('static-landing-fcp')?.remove()
  }, [])

  useEffect(() => {
    document.getElementById('static-landing-fcp')?.remove()
  }, [])

  useEffect(() => {
    const root = document.getElementById('root')
    document.documentElement.classList.add('is-landing')
    document.body.classList.add('is-landing')
    root?.classList.add('is-landing')
    return () => {
      document.documentElement.classList.remove('is-landing')
      document.body.classList.remove('is-landing')
      root?.classList.remove('is-landing')
    }
  }, [])

  return (
    <div lang={i18n.language} className="landing-page relative flex min-h-[100dvh] flex-col lux-text selection:bg-aura-gold/30">
      <div className="aura-marble-bg--landing" aria-hidden>
        <picture>
          <source media="(max-width: 767px)" srcSet={LANDING_MARBLE.mobile} type="image/webp" />
          <source srcSet={LANDING_MARBLE.desktop} type="image/webp" />
          <img
            src={LANDING_MARBLE.fallback}
            alt=""
            className="landing-page__marble"
            draggable={false}
            fetchPriority="high"
            decoding="async"
            width={1920}
            height={1080}
          />
        </picture>
        <div className="landing-page__overlay" />
        <div className="landing-page__grain" />
      </div>

      <LandingNav />
      <LuxuryGoldGradientDefs />
      <main className="relative z-10 w-full">
        <LandingHero />
        <LandingBelowFold />
      </main>
    </div>
  )
}
