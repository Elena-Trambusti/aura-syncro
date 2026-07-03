import { useState } from 'react'
import { ArrowRight, Maximize } from 'lucide-react'

import AuraIcon from '../ui/AuraIcon'
import {
  LandingSectionHeader,
  LandingSectionShell,
} from './landingLuxury'
import DemoBookingModal from './DemoBookingModal'

function FloorPlanCaption({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-[#C5A059] font-medium uppercase tracking-widest text-xs mb-1">Floor Plan 2.5D</p>
      <p className="text-[#F0E6D2] text-sm leading-snug">
        Controllo spaziale in tempo reale di ogni tavolo e comanda.
      </p>
    </div>
  )
}

export default function LandingGallery() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  return (
    <LandingSectionShell>
      <LandingSectionHeader
        title="Precisione Millimetrica nel Servizio"
        subtitle="La mappa 2.5D non è una semplice funzionalità estetica, ma il centro di comando che sincronizza ogni movimento del tuo staff."
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/15 bg-gradient-to-b from-[#1a1408]/90 via-[#0f0c08]/95 to-[#080604] shadow-[0_24px_48px_rgba(0,0,0,0.45)] group">
          <div className="relative aspect-[4/3] w-full bg-black sm:aspect-[16/9]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15),transparent_60%)]" />

            <img
              src="/brand/tavoli-floor-plan-25d.png?v=2"
              alt="Pianta tavoli 2.5D Aura Syncro"
              className="h-full w-full object-contain object-center transition-opacity duration-500 group-hover:opacity-100 sm:object-cover"
            />

            {/* Overlay leggero solo su desktop — su mobile la didascalia resta sotto */}
            <div className="absolute bottom-4 left-4 right-4 hidden items-end justify-between sm:flex">
              <div className="max-w-[min(100%,20rem)] rounded-xl border border-[#D4AF37]/20 bg-black/50 p-3 backdrop-blur-sm">
                <FloorPlanCaption />
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-black/50 backdrop-blur-sm">
                <AuraIcon icon={Maximize} size="sm" className="text-[#C5A059]" />
              </div>
            </div>
          </div>

          {/* Mobile: didascalia sotto l'immagine, non sopra */}
          <div className="border-t border-[#D4AF37]/15 bg-[#0a0a0a]/95 px-4 py-3 sm:hidden">
            <FloorPlanCaption />
          </div>
        </div>

        <div className="mt-10 flex justify-center sm:mt-16">
          <button
            type="button"
            onClick={() => setIsDemoModalOpen(true)}
            className="group relative inline-flex w-full max-w-md items-center justify-center gap-3 overflow-hidden rounded-full border border-[#C5A059]/40 bg-neutral-950/90 px-6 py-3.5 text-sm font-medium uppercase tracking-widest text-[#C5A059] backdrop-blur-md transition-all duration-300 hover:border-[#C5A059] hover:shadow-[0_0_15px_rgba(197,160,89,0.2)] sm:w-auto sm:px-8 sm:py-4"
          >
            Riserva una Demo Privata
            <AuraIcon icon={ArrowRight} size="md" className="transition-all duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>
      <DemoBookingModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </LandingSectionShell>
  )
}
