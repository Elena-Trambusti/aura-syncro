import { useState } from 'react'
import { TrendingDown, RefreshCcw, FileWarning, ArrowRight } from 'lucide-react'
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

const PROBLEMS = [
  {
    title: 'Erosione margini delivery',
    desc: 'Ogni ordine esterno ti costa fino al 30%. Senza un sistema integrato che bilancia i canali, lavori per coprire le commissioni degli altri.',
    icon: TrendingDown,
  },
  {
    title: 'Disallineamento dati',
    desc: 'Sala, cucina e cassa viaggiano a velocità diverse. Comande perse, ritardi e incomprensioni distruggono l\'esperienza del cliente e il tuo scontrino medio.',
    icon: RefreshCcw,
  },
  {
    title: 'Burocrazia soffocante',
    desc: 'Gestire corrispettivi, fatture e chiusure di cassa a fine serata ti ruba ore preziose. Il rischio di errori e sanzioni è sempre dietro l\'angolo.',
    icon: FileWarning,
  },
]

export default function LandingFeatures() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  return (
    <LandingSectionShell id="problems">
      <LandingSectionHeader
        title="Perché ogni sera perdi margine prima ancora di chiudere la cassa"
        subtitle="Sei troppo concentrato sull'operatività quotidiana per accorgerti dei micro-sprechi che erodono il tuo utile netto."
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {PROBLEMS.map((problem) => (
            <article key={problem.title} className={LUXURY_CARD_CLASS}>
              <div className="border-b border-[#D4AF37]/10 bg-gradient-to-br from-[#120e08]/80 to-transparent px-6 pb-5 pt-6 sm:px-7 sm:pt-7">
                <LuxuryIconMedallion icon={problem.icon} size="md" />
              </div>

              <div className="flex flex-1 flex-col px-6 pb-7 pt-5 sm:px-7 sm:pb-8">
                <h3 className="font-display text-xl font-medium tracking-tight text-[#F0E6D2] transition-colors duration-300 group-hover:text-white">
                  {problem.title}
                </h3>
                <p className="mt-3 flex-1 text-sm font-light leading-relaxed text-[#F0E6D2]/85">
                  {problem.desc}
                </p>
              </div>

              <LuxuryCardHoverLine />
            </article>
          ))}
        </div>
        
        <div className="mt-16 flex justify-center">
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-neutral-950/90 backdrop-blur-md border border-[#C5A059]/40 px-8 py-4 text-[#C5A059] font-medium tracking-widest uppercase text-sm transition-all duration-300 hover:border-[#C5A059] hover:shadow-[0_0_15px_rgba(197,160,89,0.2)]"
          >
            Riserva una Demo Privata
            <AuraIcon icon={ArrowRight} size="md" className="group-hover:translate-x-1 transition-all duration-300" />
          </button>
        </div>
      </div>
      <DemoBookingModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </LandingSectionShell>
  )
}
