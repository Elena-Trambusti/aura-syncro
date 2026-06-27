import { useTranslation } from 'react-i18next'
import { usePageMeta } from '../lib/usePageMeta'
import LandingNav from '../components/landing/LandingNav'
import LandingHero from '../components/landing/LandingHero'
import LandingTrustBar from '../components/landing/LandingTrustBar'
import LandingFeatures from '../components/landing/LandingFeatures'
import LandingGallery from '../components/landing/LandingGallery'
import LandingPricing from '../components/landing/LandingPricing'
import LandingFooter from '../components/landing/LandingFooter'

export default function LandingPage() {
  const { t, i18n } = useTranslation()

  usePageMeta(t('landing.meta.title'), t('landing.meta.description'))

  return (
    <div lang={i18n.language} className="min-h-[100dvh] flex flex-col relative text-white selection:bg-aura-gold/30 bg-[#020202] overflow-x-hidden">
      {/* Pure black base */}
      <div className="fixed inset-0 z-[-4] bg-black" />
      
      {/* Luxury glowing orbs - Increased visibility */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-aura-gold/20 mix-blend-screen blur-[120px] pointer-events-none animate-[float_15s_ease-in-out_infinite]" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-amber-600/15 mix-blend-screen blur-[120px] pointer-events-none animate-[float_20s_ease-in-out_infinite_reverse]" />
      
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
        <LandingTrustBar />
        <LandingFeatures />
        <LandingGallery />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  )
}
