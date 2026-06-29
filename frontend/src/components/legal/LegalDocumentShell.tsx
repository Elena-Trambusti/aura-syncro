import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { LEGAL_ENTITY } from '../../config/legal'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

export default function LegalDocumentShell({ title, subtitle, children }: Props) {
  return (
    <div className="aura-auth-shell min-h-screen px-4 py-16">
      <div className="premium-card mx-auto max-w-4xl space-y-8 p-8 sm:p-12">
        <div className="border-b border-white/10 pb-6">
          <p className="aura-brand-eyebrow mb-2">{LEGAL_ENTITY.tradeName}</p>
          <h1 className="text-3xl font-display font-medium text-white mb-4">{title}</h1>
          {subtitle && <p className="text-sm text-fumo">{subtitle}</p>}
        </div>
        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">{children}</div>
        <div className="border-t border-white/10 pt-6 text-xs text-slate-500 space-y-2">
          <p>
            {LEGAL_ENTITY.ownerName} · P.IVA {LEGAL_ENTITY.vatNumber} · {LEGAL_ENTITY.addressLine}
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="text-aura-gold hover:underline">Privacy</Link>
            <Link to="/termini" className="text-aura-gold hover:underline">Termini</Link>
            <Link to="/cookie" className="text-aura-gold hover:underline">Cookie</Link>
            <Link to="/dpa" className="text-aura-gold hover:underline">DPA</Link>
            <Link to="/informativa-ospiti" className="text-aura-gold hover:underline">Informativa ospiti</Link>
            <Link to="/contatti" className="text-aura-gold hover:underline">Contatti</Link>
          </nav>
        </div>
        <div className="pt-4 text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-xl px-6 py-3 text-xs uppercase tracking-[0.15em] font-bold text-white transition-all duration-300 hover:bg-white/10 hover:border-aura-gold/50">
            Torna alla Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-aura-gold">{title}</h2>
      {children}
    </section>
  )
}
