import RegisterLink from './RegisterLink'
import { useTranslation } from 'react-i18next'
import { Check, X, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ui } from '../../lib/ui'
import AuraIcon from '../ui/AuraIcon'

const PRICING_CTA_CLASS =
  'group relative mt-8 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-8 py-4 text-xs font-bold uppercase tracking-[0.15em] text-black shadow-[0_0_40px_rgba(212,175,55,0.4)] ring-1 ring-white/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(212,175,55,0.6)]'

export default function LandingPricing() {
  const { t } = useTranslation()

  const PLANS = [
    {
      id: 'starter',
      name: t('landing.pricing.starter.name', { defaultValue: 'Starter' }),
      tagline: t('landing.pricing.starter.tagline', { defaultValue: 'Per piccoli locali o food truck.' }),
      price: t('landing.pricing.starter.price', { defaultValue: '€99/mese + IVA' }),
      setup: t('landing.pricing.starter.setup', { defaultValue: '+ €250 setup (Una tantum) + IVA' }),
      features: t('landing.pricing.starter.features', { returnObjects: true, defaultValue: [
        'Gestione fino a 12 tavoli',
        '1 singola area (Sala)',
        'Menu QR digitale',
        'Pagamenti Stripe integrati',
      ]}) as string[],
      missingFeatures: t('landing.pricing.starter.missingFeatures', { returnObjects: true, defaultValue: [
        'AI Predittiva e Analytics',
        'Gestione Turni e Scorte',
      ]}) as string[],
    },
    {
      id: 'pro',
      name: t('landing.pricing.pro.name', { defaultValue: 'Premium' }),
      badge: t('landing.pricing.pro.badge', { defaultValue: 'Consigliato' }),
      tagline: t('landing.pricing.pro.tagline', { defaultValue: 'Per ristoranti che esigono il massimo.' }),
      price: t('landing.pricing.pro.price', { defaultValue: '€199/mese + IVA' }),
      setup: t('landing.pricing.pro.setup', { defaultValue: '+ €500 setup (Una tantum) + IVA' }),
      features: t('landing.pricing.pro.features', { returnObjects: true, defaultValue: [
        'Aree e tavoli illimitati',
        'AI Predittiva e Analytics',
        'Onboarding chiavi in mano',
        'Gestione Turni e Scorte',
        'Marketing Automation'
      ]}) as string[],
      missingFeatures: t('landing.pricing.pro.missingFeatures', { returnObjects: true, defaultValue: []}) as string[],
    }
  ]

  return (
    <section id="pricing" className="relative z-0 bg-transparent px-4 py-24 sm:px-6 sm:py-32">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[700px] w-[700px] rounded-full bg-amber-500/5 blur-[150px]" />
      </div>
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="lux-heading text-[#C5A059] text-3xl font-bold tracking-tighter sm:text-4xl">{t('landing.pricing.title', { defaultValue: 'Prezzi Semplici, Nessuna Sorpresa' })}</h2>
          <p className="mt-3 text-slate-300">{t('landing.pricing.subtitle', { defaultValue: 'Scegli il piano giusto per la tua attività.' })}</p>
        </div>

        <div className="mt-14 mx-auto grid max-w-md grid-cols-1 gap-8 md:max-w-4xl md:grid-cols-2 md:gap-y-10">
          {PLANS.map(plan => {
            const isPro = plan.id === 'pro'
            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col p-8',
                  isPro
                    ? cn(
                        ui.glassSatin,
                        '!overflow-visible pt-2 md:mt-3',
                        'scale-[1.01] lux-text-soft transition-all duration-500 md:hover:scale-[1.03] hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]',
                      )
                    : cn(ui.glass, 'lux-text-muted shadow-sm transition-all md:hover:scale-[1.01]'),
                )}
              >
                {isPro && (
                  <span className="absolute -top-3.5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-[#d4af37] to-[#aa8c2c] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] ring-1 ring-white/20">
                    <AuraIcon icon={Sparkles} size="sm" className="text-black" />
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-lg font-bold text-slate-100">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  {plan.tagline}
                </p>
                <div className="mt-6">
                  <p className={cn('text-3xl font-extrabold', isPro ? 'text-[#E8C872]' : 'text-[#D4AF37]')}>
                    {plan.price}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {plan.setup}
                  </p>
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-200">
                      <AuraIcon
                        icon={Check}
                        size="md"
                        className={cn('mt-0.5 shrink-0', isPro ? 'text-[#E8C872]' : 'text-[#D4AF37]')}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                  {plan.missingFeatures.map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-500 line-through">
                      <AuraIcon icon={X} size="md" className="mt-0.5 shrink-0 text-[#8C7A52]/50" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <RegisterLink className={PRICING_CTA_CLASS}>
                  <div className="absolute inset-0 hidden w-[50%] bg-gradient-to-r from-transparent via-white/40 to-transparent motion-safe:md:block motion-safe:md:animate-[shimmer-sweep_3s_ease-in-out_infinite]" />
                  <span className="relative">{t('landing.pricing.cta', { defaultValue: 'Inizia Ora' })}</span>
                  <AuraIcon icon={ArrowRight} size="md" className="relative text-black" />
                </RegisterLink>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
