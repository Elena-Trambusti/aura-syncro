import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '../lib/usePageMeta'
import LandingNav from '../components/landing/LandingNav'
import LandingHero from '../components/landing/LandingHero'
const LandingTrustBar = lazy(() => import('../components/landing/LandingTrustBar'))
const LandingFeatures = lazy(() => import('../components/landing/LandingFeatures'))

const LandingGallery = lazy(() => import('../components/landing/LandingGallery'))
const LandingPricing = lazy(() => import('../components/landing/LandingPricing'))
const LandingFooter = lazy(() => import('../components/landing/LandingFooter'))

export default function LandingPage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('landing.meta.title'), t('landing.meta.description'))

  return (
    <div lang={i18n.language} className="min-h-[100dvh] flex flex-col relative lux-text selection:bg-aura-gold/30 bg-[#020202] overflow-x-hidden">
      {/* Pure black base */}
      <div className="fixed inset-0 z-[-4] bg-black" />
      
      {/* Effetti visuali pesanti: solo desktop per ridurre paint mobile */}
      <div className="pointer-events-none fixed top-[-10%] left-[-10%] hidden h-[50vw] w-[50vw] rounded-full bg-aura-gold/20 blur-[120px] md:block motion-safe:md:animate-[float_15s_ease-in-out_infinite]" />
      <div className="pointer-events-none fixed right-[-10%] bottom-[-10%] hidden h-[40vw] w-[40vw] rounded-full bg-amber-600/15 blur-[120px] md:block motion-safe:md:animate-[float_20s_ease-in-out_infinite_reverse]" />
      
      {/* Top gold spotlight */}
      <div className="fixed inset-0 z-[-3] pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.15),rgba(0,0,0,0))]" />
      
      {/* Executive Grid Pattern overlay - Increased visibility */}
      <div 
        className="fixed inset-0 z-[-2] pointer-events-none opacity-[0.12]"
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', 
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)'
        }}
      />
      <LandingNav />
      <main className="flex-1">
        <LandingHero />
        <Suspense fallback={<div className="h-16" aria-hidden />}>
          <LandingTrustBar />
          <LandingFeatures />
          <LandingGallery />
          <LandingPricing />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <LandingFooter />
      </Suspense>
    </div>
  )
}
