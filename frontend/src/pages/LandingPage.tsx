import { useTranslation } from 'react-i18next'
import { usePageMeta } from '../lib/usePageMeta'
import LandingNav from '../components/landing/LandingNav'
import LandingHero from '../components/landing/LandingHero'
import LandingTrustBar from '../components/landing/LandingTrustBar'
import LandingFeatures from '../components/landing/LandingFeatures'
import LandingPricing from '../components/landing/LandingPricing'
import LandingFooter from '../components/landing/LandingFooter'

export default function LandingPage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('landing.meta.title'), t('landing.meta.description'))

  return (
    <div lang={i18n.language} className="min-h-[100dvh] flex flex-col bg-[#030712] text-white selection:bg-amber-500/30">
      <LandingNav />
      <main className="flex-1">
        <LandingHero />
        <LandingTrustBar />
        <LandingFeatures />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  )
}
