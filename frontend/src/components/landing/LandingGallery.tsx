import { useState } from 'react'
import { ArrowRight, Maximize } from 'lucide-react'

import AuraIcon from '../ui/AuraIcon'
import {
  LandingSectionHeader,
  LandingSectionShell,
} from './landingLuxury'
import DemoBookingModal from './DemoBookingModal'

export default function LandingGallery() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  return (
    <LandingSectionShell>
      <LandingSectionHeader
        title="Precisione Millimetrica nel Servizio"
        subtitle="La mappa 2.5D non è una semplice funzionalità estetica, ma il centro di comando che sincronizza ogni movimento del tuo staff."
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 lg:px-8">
        <div className="relative rounded-2xl overflow-hidden border border-[#D4AF37]/15 bg-gradient-to-b from-[#1a1408]/90 via-[#0f0c08]/95 to-[#080604] shadow-[0_24px_48px_rgba(0,0,0,0.45)] group">
           <div className="aspect-[16/9] w-full bg-black relative flex items-center justify-center">
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15),transparent_60%)] pointer-events-none" />
             
             <img 
               src="/brand/tavoli-floor-plan-25d.png" 
               alt="Pianta tavoli 2.5D Aura Syncro" 
               className="w-full h-full object-cover opacity-90 transition-opacity duration-500 group-hover:opacity-100"
             />
             <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 border border-[#D4AF37]/20">
                  <p className="text-[#C5A059] font-medium uppercase tracking-widest text-xs mb-1">Floor Plan 2.5D</p>
                  <p className="text-[#F0E6D2] text-sm">Controllo spaziale in tempo reale di ogni tavolo e comanda.</p>
                </div>
                <div className="h-10 w-10 bg-black/60 backdrop-blur-md rounded-full border border-[#D4AF37]/20 flex items-center justify-center">
                   <AuraIcon icon={Maximize} size="sm" className="text-[#C5A059]" />
                </div>
             </div>
           </div>
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
