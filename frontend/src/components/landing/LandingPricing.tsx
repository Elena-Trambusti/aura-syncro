import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Wrench, Headphones, LayoutDashboard } from 'lucide-react'
import { cn } from '../../lib/utils'
import AuraIcon from '../ui/AuraIcon'
import {
  LandingSectionHeader,
  LandingSectionShell,
  LUXURY_CARD_CLASS,
  LuxuryCardHoverLine,
  LuxuryIconMedallion,
} from './landingLuxury'
import DemoBookingModal from './DemoBookingModal'

export default function LandingPricing() {
  const { t } = useTranslation()
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  return (
    <LandingSectionShell id="concierge">
      <LandingSectionHeader
        title={t('landing.concierge.title')}
        subtitle={t('landing.concierge.subtitle')}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 lg:px-8">
        <div className={cn(LUXURY_CARD_CLASS, "p-8 sm:p-12 text-center items-center ring-1 ring-[#D4AF37]/25")}>
          <div className="flex gap-4 mb-8">
             <LuxuryIconMedallion icon={LayoutDashboard} size="md" />
             <LuxuryIconMedallion icon={Wrench} size="md" />
             <LuxuryIconMedallion icon={Headphones} size="md" />
          </div>
          <h3 className="font-display text-3xl font-medium tracking-tight text-[#F0E6D2]">
            {t('landing.concierge.heading')}
          </h3>
          <p className="mt-4 text-base font-light leading-relaxed lux-text-soft max-w-2xl mx-auto">
            {t('landing.concierge.body')}
          </p>
          
          <div className="mt-12 w-full flex justify-center">
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-neutral-950/90 backdrop-blur-md border border-[#C5A059]/40 px-8 py-4 text-[#C5A059] font-medium tracking-widest uppercase text-sm transition-all duration-300 hover:border-[#C5A059] hover:shadow-[0_0_15px_rgba(197,160,89,0.2)] w-full sm:w-auto"
            >
              {t('landing.hero.ctaDemoPrivate')}
              <AuraIcon icon={ArrowRight} size="md" className="group-hover:translate-x-1 transition-all duration-300" />
            </button>
          </div>
          <LuxuryCardHoverLine />
        </div>
      </div>
      <DemoBookingModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </LandingSectionShell>
  )
}
