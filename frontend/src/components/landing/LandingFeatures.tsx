import { useTranslation } from 'react-i18next'
import { UtensilsCrossed, QrCode, CreditCard, Scale, BrainCircuit, Users, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  LandingSectionHeader,
  LandingSectionShell,
  LUXURY_CARD_CLASS,
  LuxuryCardHoverLine,
  LuxuryIconMedallion,
} from './landingLuxury'

const FEATURES: Array<{ key: string; icon: LucideIcon; className: string; featured?: boolean }> = [
  { key: 'tables', icon: UtensilsCrossed, className: 'lg:col-span-2 lg:row-span-2', featured: true },
  { key: 'qrMenu', icon: QrCode, className: '' },
  { key: 'stripe', icon: CreditCard, className: '' },
  { key: 'fiscal', icon: Scale, className: 'lg:col-span-2' },
  { key: 'crm', icon: Users, className: 'lg:col-span-2' },
  { key: 'ai', icon: BrainCircuit, className: 'lg:col-span-2' },
]

function FeatureCard({
  icon,
  title,
  desc,
  featured,
  className,
}: {
  icon: LucideIcon
  title: string
  desc: string
  featured?: boolean
  className?: string
}) {
  return (
    <article className={cn(LUXURY_CARD_CLASS, className)}>
      {featured ? (
        <div className="relative flex w-full min-h-[11rem] flex-col items-center justify-center overflow-hidden border-b border-[#D4AF37]/10 bg-gradient-to-br from-[#120e08] to-[#080604] lg:min-h-[14rem] lg:overflow-visible">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D4AF37]/[0.08]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#D4AF37]/[0.05]"
            aria-hidden
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.16),transparent_70%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
          <LuxuryIconMedallion icon={icon} size="lg" className="mx-auto" />
        </div>
      ) : (
        <div className="border-b border-[#D4AF37]/10 bg-gradient-to-br from-[#120e08]/80 to-transparent px-6 pb-5 pt-6 sm:px-7 sm:pt-7">
          <LuxuryIconMedallion icon={icon} size="md" />
        </div>
      )}

      <div
        className={cn(
          'flex flex-1 flex-col',
          featured
            ? 'items-center p-7 text-center sm:p-8 lg:items-start lg:p-8 lg:text-left'
            : 'px-6 pb-7 pt-5 sm:px-7 sm:pb-8',
        )}
      >
        <h3 className="font-display text-lg font-medium tracking-tight text-[#F0E6D2] transition-colors duration-300 group-hover:text-white sm:text-xl">
          {title}
        </h3>
        <p className="mt-3 flex-1 text-sm font-light leading-relaxed text-[#F0E6D2]/85">
          {desc}
        </p>
      </div>

      <LuxuryCardHoverLine />
    </article>
  )
}

export default function LandingFeatures() {
  const { t } = useTranslation()

  return (
    <LandingSectionShell id="features">
      <LandingSectionHeader
        eyebrow={t('landing.features.eyebrow')}
        title={t('landing.features.title')}
        subtitle={t('landing.features.subtitle')}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {FEATURES.map(({ key, icon, className, featured }) => (
            <FeatureCard
              key={key}
              icon={icon}
              featured={featured}
              className={className}
              title={t(`landing.features.${key}.title`)}
              desc={t(`landing.features.${key}.desc`)}
            />
          ))}
        </div>
      </div>
    </LandingSectionShell>
  )
}
