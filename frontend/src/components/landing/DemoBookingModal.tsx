import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { AuraDialog } from '@/components/ui/AuraDialog'
import AuraIcon from '../ui/AuraIcon'
import { toast } from '@/lib/toast'

export default function DemoBookingModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    // Simulazione invio
    setTimeout(() => {
      setIsSubmitting(false)
      toast.success('Richiesta inviata con successo. Il nostro team ti contatterà a breve.')
      onClose()
    }, 1000)
  }

  return (
    <AuraDialog onClose={onClose} hideClose className="max-w-md p-0 overflow-hidden bg-neutral-950 border border-[#C5A059]/30">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-neutral-400 hover:text-[#C5A059] transition-colors bg-black/40 rounded-full backdrop-blur-md"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 sm:p-10 text-center">
          <h2 className="lux-heading font-display text-2xl sm:text-3xl font-medium tracking-tight text-[#C5A059] mb-3">
            Riserva una Demo Privata
          </h2>
          <p className="text-sm font-light text-[#F0E6D2] mb-8">
            Lascia i tuoi recapiti per essere ricontattato dal nostro team Concierge e fissare una sessione personalizzata.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label htmlFor="name" className="block text-xs font-medium uppercase tracking-widest text-[#C5A059] mb-1.5">Nome e Cognome</label>
              <input
                type="text"
                id="name"
                required
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-[#F0E6D2] placeholder:text-neutral-600 focus:outline-none focus:border-[#C5A059]/50 focus:ring-1 focus:ring-[#C5A059]/50 transition-all"
                placeholder="Mario Rossi"
              />
            </div>
            <div>
              <label htmlFor="restaurant" className="block text-xs font-medium uppercase tracking-widest text-[#C5A059] mb-1.5">Nome Ristorante</label>
              <input
                type="text"
                id="restaurant"
                required
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-[#F0E6D2] placeholder:text-neutral-600 focus:outline-none focus:border-[#C5A059]/50 focus:ring-1 focus:ring-[#C5A059]/50 transition-all"
                placeholder="Osteria La Bella"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs font-medium uppercase tracking-widest text-[#C5A059] mb-1.5">Numero di Telefono</label>
              <input
                type="tel"
                id="phone"
                required
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-[#F0E6D2] placeholder:text-neutral-600 focus:outline-none focus:border-[#C5A059]/50 focus:ring-1 focus:ring-[#C5A059]/50 transition-all"
                placeholder="+39 333 1234567"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex items-center justify-center gap-2 mt-6 overflow-hidden rounded-full bg-neutral-950/90 backdrop-blur-md border border-[#C5A059]/40 px-6 py-4 text-[#C5A059] font-medium tracking-widest uppercase text-sm transition-all duration-300 hover:border-[#C5A059] hover:shadow-[0_0_15px_rgba(197,160,89,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Invio in corso...' : 'Invia Richiesta'}
              {!isSubmitting && <AuraIcon icon={Send} size="sm" className="group-hover:translate-x-1 transition-all duration-300" />}
            </button>
          </form>
        </div>
      </div>
    </AuraDialog>
  )
}
