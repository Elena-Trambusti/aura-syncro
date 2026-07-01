import RegisterLink from './RegisterLink'
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

export default function LandingPricing() {
  const { t } = useTranslation()

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
                  isPro && '!overflow-visible ring-1 ring-[#D4AF37]/25 md:scale-[1.02]',
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
                  <p className="mt-2 text-sm font-light lux-text-muted">
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

                <RegisterLink className={cn(LUXURY_CTA_CLASS, 'mt-10')}>
                  <div className="absolute inset-0 hidden w-[50%] bg-gradient-to-r from-transparent via-white/35 to-transparent motion-safe:md:block motion-safe:md:animate-[shimmer-sweep_3s_ease-in-out_infinite]" />
                  <span className="relative">{t('landing.pricing.cta', { defaultValue: 'Inizia Ora' })}</span>
                  <AuraIcon icon={ArrowRight} size="md" className="relative text-black" />
                </RegisterLink>

                <LuxuryCardHoverLine />
              </article>
            )
          })}
        </div>
      </div>
    </LandingSectionShell>
  )
}
