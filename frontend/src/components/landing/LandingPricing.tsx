import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Minus, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import AuraIcon from '../ui/AuraIcon'
import {
  LandingSectionHeader,
  LandingSectionShell,
  LUXURY_CARD_CLASS,
  LUXURY_CTA_CLASS,
  LuxuryCardHoverLine,
} from './landingLuxury'
import DemoBookingModal from './DemoBookingModal'

export default function LandingPricing() {
  const { t } = useTranslation()
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  const PLANS = [
    {
      id: 'starter',
      name: t('landing.pricing.starter.name', { defaultValue: 'Starter' }),
      tagline: t('landing.pricing.starter.tagline', { defaultValue: 'Per piccoli locali o food truck.' }),
      price: t('landing.pricing.starter.price', { defaultValue: '€99/mese + IVA' }),
      setup: t('landing.pricing.starter.setup', { defaultValue: '+ €250 setup (Una tantum) + IVA' }),
      features: t('landing.pricing.starter.features', {
        returnObjects: true,
        defaultValue: [
          'Gestione fino a 12 tavoli',
          '1 singola area (Sala)',
          'Menu QR digitale',
          'Pagamenti Stripe integrati',
        ],
      }) as string[],
      missingFeatures: t('landing.pricing.starter.missingFeatures', {
        returnObjects: true,
        defaultValue: ['AI Predittiva e Analytics', 'Gestione Turni e Scorte'],
      }) as string[],
    },
    {
      id: 'pro',
      name: t('landing.pricing.pro.name', { defaultValue: 'Premium' }),
      badge: t('landing.pricing.pro.badge', { defaultValue: 'Consigliato' }),
      tagline: t('landing.pricing.pro.tagline', { defaultValue: 'Per ristoranti che esigono il massimo.' }),
      price: t('landing.pricing.pro.price', { defaultValue: '€199/mese + IVA' }),
      setup: t('landing.pricing.pro.setup', { defaultValue: '+ €500 setup (Una tantum) + IVA' }),
      features: t('landing.pricing.pro.features', {
        returnObjects: true,
        defaultValue: [
          'Aree e tavoli illimitati',
          'AI Predittiva e Analytics',
          'Onboarding chiavi in mano',
          'Gestione Turni e Scorte',
          'Marketing Automation',
        ],
      }) as string[],
      missingFeatures: t('landing.pricing.pro.missingFeatures', {
        returnObjects: true,
        defaultValue: [],
      }) as string[],
    },
  ]

  return (
    <LandingSectionShell id="pricing">
      <LandingSectionHeader
        eyebrow={t('landing.pricing.eyebrow')}
        title={t('landing.pricing.title', { defaultValue: 'Prezzi Semplici, Nessuna Sorpresa' })}
        subtitle={t('landing.pricing.subtitle', { defaultValue: 'Scegli il piano giusto per la tua attività.' })}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          {PLANS.map(plan => {
            const isPro = plan.id === 'pro'
            return (
              <article
                key={plan.id}
                className={cn(
                  LUXURY_CARD_CLASS,
                  'p-8 sm:p-9',
                  isPro && '!overflow-visible ring-1 ring-[#D4AF37]/25',
                )}
              >
                {isPro && plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D4AF37]/35 bg-[#0f0c08] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8C872] shadow-[0_0_24px_rgba(212,175,55,0.2)]">
                    <AuraIcon icon={Sparkles} size="sm" className="text-[#E8C872]" />
                    {plan.badge}
                  </span>
                )}

                <h3 className="font-display text-2xl font-medium tracking-tight text-[#F0E6D2]">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm font-light leading-relaxed lux-text-soft">
                  {plan.tagline}
                </p>

                <div className="mt-8 border-b border-[#D4AF37]/10 pb-8">
                  <p className="lux-heading font-display text-3xl font-medium tracking-tight sm:text-4xl">
                    {plan.price}
                  </p>
                  <p className="mt-2 text-sm font-light text-[#F0E6D2]">
                    {plan.setup}
                  </p>
                </div>

                <ul className="mt-8 flex-1 space-y-3.5">
                  {plan.features.map(line => (
                    <li key={line} className="flex items-start gap-3 text-sm font-light text-[#F0E6D2]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/25 bg-black/40">
                        <AuraIcon icon={Check} size="sm" weight="display" className="text-[#E8C872]" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                  {plan.missingFeatures.map(line => (
                    <li key={line} className="flex items-start gap-3 text-sm font-light text-[#F0E6D2]/35">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#F0E6D2]/10 bg-black/20">
                        <AuraIcon icon={Minus} size="sm" weight="display" className="text-[#F0E6D2]/30" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 min-h-[48px] flex items-end justify-center">
                  <p className={cn("text-neutral-400 text-xs italic text-center", !isPro && "invisible")}>
                    Il piano include il servizio Concierge: mappatura personalizzata della sala in 2.5D e caricamento del menu digitale a cura del nostro team tecnico prima del go-live.
                  </p>
                </div>

                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="mt-6 w-full group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-neutral-950/90 backdrop-blur-md border border-[#C5A059]/40 px-8 py-4 text-[#C5A059] font-medium tracking-widest uppercase text-sm transition-all duration-300 hover:border-[#C5A059] hover:shadow-[0_0_15px_rgba(197,160,89,0.2)]"
                >
                  Riserva una Demo Privata
                  <AuraIcon icon={ArrowRight} size="md" className="group-hover:translate-x-1 transition-all duration-300" />
                </button>

                <LuxuryCardHoverLine />
              </article>
            )
          })}
        </div>
      </div>
      <DemoBookingModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </LandingSectionShell>
  )
}
