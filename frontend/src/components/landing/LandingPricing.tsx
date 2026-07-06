import { useTranslation } from 'react-i18next'
import { Check, Minus, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import AuraIcon from '../ui/AuraIcon'
import {
  LandingSectionHeader,
  LandingSectionShell,
  LUXURY_CARD_CLASS,
  LuxuryCardHoverLine,
} from './landingLuxury'

type PricingPlan = {
  id: 'starter' | 'pro'
  name: string
  tagline: string
  price: string
  setup: string
  features: string[]
  missingFeatures: string[]
  badge?: string
  conciergeNote?: string
}

export default function LandingPricing() {
  const { t } = useTranslation()

  const plans: PricingPlan[] = [
    {
      id: 'starter',
      name: t('landing.pricing.starter.name'),
      tagline: t('landing.pricing.starter.tagline'),
      price: t('landing.pricing.starter.price'),
      setup: t('landing.pricing.starter.setup'),
      features: t('landing.pricing.starter.features', { returnObjects: true }) as string[],
      missingFeatures: t('landing.pricing.starter.missingFeatures', { returnObjects: true }) as string[],
    },
    {
      id: 'pro',
      name: t('landing.pricing.pro.name'),
      badge: t('landing.pricing.pro.badge'),
      tagline: t('landing.pricing.pro.tagline'),
      price: t('landing.pricing.pro.price'),
      setup: t('landing.pricing.pro.setup'),
      features: t('landing.pricing.pro.features', { returnObjects: true }) as string[],
      missingFeatures: t('landing.pricing.pro.missingFeatures', { returnObjects: true }) as string[],
      conciergeNote: t('landing.pricing.pro.conciergeNote'),
    },
  ]

  return (
    <LandingSectionShell id="pricing">
      <LandingSectionHeader
        eyebrow={t('landing.pricing.eyebrow')}
        title={t('landing.pricing.title')}
        subtitle={t('landing.pricing.subtitle')}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          {plans.map((plan) => {
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
                {isPro && plan.badge ? (
                  <span className="absolute -top-3.5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D4AF37]/35 bg-[#0f0c08] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8C872] shadow-[0_0_24px_rgba(212,175,55,0.2)]">
                    <AuraIcon icon={Sparkles} size="sm" className="text-[#E8C872]" />
                    {plan.badge}
                  </span>
                ) : null}

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
                  {plan.features.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-sm font-light text-[#F0E6D2]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/25 bg-black/40">
                        <AuraIcon icon={Check} size="sm" weight="display" className="text-[#E8C872]" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                  {plan.missingFeatures.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-sm font-light text-[#F0E6D2]/35">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#F0E6D2]/10 bg-black/20">
                        <AuraIcon icon={Minus} size="sm" weight="display" className="text-[#F0E6D2]/30" />
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {isPro && plan.conciergeNote ? (
                  <p className="mt-6 text-center text-xs font-light italic leading-relaxed text-[#F0E6D2]/55">
                    {plan.conciergeNote}
                  </p>
                ) : null}

                <LuxuryCardHoverLine />
              </article>
            )
          })}
        </div>
      </div>
    </LandingSectionShell>
  )
}
