import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X } from 'lucide-react'

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Check if user already accepted
    const consent = localStorage.getItem('aura-cookie-consent')
    if (!consent) {
      // Small delay for animation
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('aura-cookie-consent', 'accepted')
    setIsVisible(false)
  }

  const handleDecline = () => {
    // We only use technical cookies anyway, but we register the dismissal
    localStorage.setItem('aura-cookie-consent', 'declined')
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm sm:max-w-md animate-reveal-slide [animation-fill-mode:both]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/90 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-aura-gold/10 blur-[40px] pointer-events-none" />

        <div className="relative flex items-start gap-4">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-aura-gold shadow-inner">
            <Cookie className="h-5 w-5" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">Gestione Cookie</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Utilizziamo cookie tecnici essenziali, Stripe (pagamenti), statistiche aggregate Vercel e monitoraggio errori (Sentry). Nessun tracciamento pubblicitario.{' '}
              <Link to="/cookie" className="text-aura-gold hover:underline">
                Cookie Policy
              </Link>.
            </p>
            
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleAccept}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)]"
              >
                Accetta e chiudi
              </button>
            </div>
          </div>

          <button 
            onClick={handleDecline}
            className="absolute top-0 right-0 p-1 text-slate-500 hover:text-white transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
