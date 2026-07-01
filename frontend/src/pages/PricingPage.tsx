import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePublicPageMeta } from '../lib/publicPageMeta'

export default function PricingPage() {
  const { t } = useTranslation()
  usePublicPageMeta(t('publicMeta.pricing.title'), t('publicMeta.pricing.description'))

  return (
    <div className="min-h-screen bg-navy aura-auth-shell flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-pietra tracking-tight">Aura Syncro - Prezzi</h1>
          <p className="mt-2 text-fumo">L'OS Executive per la Ristorazione. Un solo piano, tutto incluso.</p>
        </div>

        <div className="premium-card p-8 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-aura-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          <h2 className="text-xl font-bold text-aura-gold mb-6 uppercase tracking-widest">Premium All-Inclusive</h2>
          
          <div className="space-y-4 mb-8">
            <div className="p-4 rounded-xl border border-white/10 bg-white/5">
              <p className="text-sm text-fumo uppercase tracking-wider mb-1">Setup Iniziale (Una tantum)</p>
              <p className="text-3xl font-bold text-pietra tabular-nums">€ 500<span className="text-sm text-fumo ml-1">+ IVA</span></p>
            </div>
            
            <div className="p-4 rounded-xl border border-aura-gold/30 bg-aura-gold/5 shadow-[inset_0_0_20px_rgba(212,175,55,0.05)]">
              <p className="text-sm text-aura-gold/80 uppercase tracking-wider mb-1">Canone Ricorrente</p>
              <p className="text-4xl font-display font-bold text-aura-gold tabular-nums">€ 199<span className="text-lg text-aura-gold/60 font-medium">/mese + IVA</span></p>
            </div>
          </div>

          <div className="text-sm text-fumo leading-relaxed bg-navy-surface/50 rounded-lg p-4 border border-white/[0.04]">
            Include l'intero ecosistema:<br/>
            <span className="text-pietra font-semibold">CRM, AI Predictive, Marketing, Fedeltà, Analytics, Report Fiscali e Pagamenti Digitali.</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/register" className="saas-btn-primary flex-1 py-3.5 text-center shadow-lg">Inizia ora</Link>
          <Link to="/login" className="aura-btn-ghost flex-1 py-3.5 text-center">Accedi</Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-medium text-fumo pt-4">
          <Link to="/privacy" className="hover:text-aura-gold transition-colors">Privacy</Link>
          <span>&middot;</span>
          <Link to="/termini" className="hover:text-aura-gold transition-colors">Termini</Link>
          <span>&middot;</span>
          <Link to="/cookie" className="hover:text-aura-gold transition-colors">Cookie</Link>
          <span>&middot;</span>
          <Link to="/dpa" className="hover:text-aura-gold transition-colors">DPA</Link>
          <span>&middot;</span>
          <Link to="/informativa-ospiti" className="hover:text-aura-gold transition-colors">Privacy ospiti</Link>
        </div>
      </div>
    </div>
  )
}