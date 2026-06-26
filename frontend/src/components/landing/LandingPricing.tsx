import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, X, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Per piccoli locali o food truck.',
    price: '€99/mese',
    setup: '+ €250 setup (Una tantum)',
    features: [
      'Gestione fino a 12 tavoli',
      '1 singola area (Sala)',
      'Menu QR digitale',
      'Pagamenti Stripe integrati',
    ],
    missingFeatures: [
      'AI Predittiva e Analytics',
      'Gestione Turni e Scorte',
    ]
  },
  {
    id: 'pro',
    name: 'Premium',
    tagline: 'Per ristoranti che esigono il massimo.',
    price: '€199/mese',
    setup: '+ €500 setup concierge',
    features: [
      'Aree e tavoli illimitati',
      'AI Predittiva e Analytics',
      'Onboarding chiavi in mano',
      'Gestione Turni e Scorte',
      'Marketing Automation'
    ],
    missingFeatures: []
  }
]

export default function LandingPricing() {
  const { t } = useTranslation()

  return (
    <section id="pricing" className="relative bg-[#030712] px-4 py-24 sm:px-6 sm:py-32 overflow-hidden z-0">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[700px] w-[700px] rounded-full bg-amber-500/5 blur-[150px]" />
      </div>
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-neutral-400">{t('landing.pricing.title', { defaultValue: 'Prezzi Semplici, Nessuna Sorpresa' })}</h2>
          <p className="mt-3 text-slate-300">{t('landing.pricing.subtitle', { defaultValue: 'Scegli il piano giusto per la tua attività.' })}</p>
        </div>

        <div className="mt-14 mx-auto grid max-w-md grid-cols-1 gap-8 md:max-w-4xl md:grid-cols-2">
          {PLANS.map(plan => {
            const isPro = plan.id === 'pro'
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-8',
                  isPro
                    ? 'scale-[1.01] border-white/[0.08] bg-white/[0.02] backdrop-blur-xl text-slate-100 shadow-[0_8_32px_0_rgba(0,0,0,0.37)] transition-all duration-500 md:hover:scale-[1.03] hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                    : 'border-white/5 bg-slate-900/50 backdrop-blur-sm text-slate-100 shadow-sm transition-all md:hover:scale-[1.01]',
                )}
              >
                {isPro && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                    <Sparkles className="h-3 w-3" />
                    Consigliato
                  </span>
                )}
                <h3 className={cn('text-lg font-bold', isPro ? 'text-white' : 'text-slate-200')}>
                  {plan.name}
                </h3>
                <p className={cn('mt-1 text-sm', isPro ? 'text-slate-300' : 'text-slate-400')}>
                  {plan.tagline}
                </p>
                <div className="mt-6">
                  <p className={cn('text-3xl font-extrabold', isPro ? 'text-white' : 'text-slate-200')}>
                    {plan.price}
                  </p>
                  <p className={cn('mt-1 text-sm', isPro ? 'text-slate-300' : 'text-slate-400')}>
                    {plan.setup}
                  </p>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map(line => (
                    <li key={line} className={cn('flex items-start gap-2 text-sm', isPro ? 'text-slate-200' : 'text-slate-300')}>
                      <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isPro ? 'text-amber-300' : 'text-emerald-500')} />
                      <span>{line}</span>
                    </li>
                  ))}
                  {plan.missingFeatures.map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-500/60 line-through">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-600/50" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={cn(
                    'mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition-all',
                    isPro
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-[pulse_3s_ease-in-out_infinite]'
                      : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
                  )}
                >
                  {t('landing.pricing.cta', { defaultValue: 'Inizia Ora' })}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
