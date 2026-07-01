import { useTranslation } from 'react-i18next'
import { UtensilsCrossed, QrCode, CreditCard, Scale, BrainCircuit, Users, type LucideIcon } from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'
import { cn } from '../../lib/utils'
import {
  LandingSectionHeader,
  LandingSectionShell,
  LUXURY_CARD_CLASS,
  LuxuryCardHoverLine,
} from './landingLuxury'

const FEATURES: Array<{ key: string; icon: LucideIcon; className: string; featured?: boolean }> = [
  { key: 'tables', icon: UtensilsCrossed, className: 'lg:col-span-2 lg:row-span-2', featured: true },
  { key: 'qrMenu', icon: QrCode, className: '' },
  { key: 'stripe', icon: CreditCard, className: '' },
  { key: 'fiscal', icon: Scale, className: 'lg:col-span-2' },
  { key: 'crm', icon: Users, className: 'lg:col-span-2' },
  { key: 'ai', icon: BrainCircuit, className: 'lg:col-span-2' },
]

function FeatureIconTile({ icon, large }: { icon: LucideIcon; large?: boolean }) {
  return (
    <div
      className={cn(
        'relative z-10 flex items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-black/60 text-[#E8C872] shadow-[0_0_28px_rgba(212,175,55,0.18)] backdrop-blur-sm transition-all duration-500 group-hover:scale-105 group-hover:border-[#E8C872]/40 group-hover:shadow-[0_0_36px_rgba(212,175,55,0.28)]',
        large ? 'h-[4.5rem] w-[4.5rem]' : 'h-14 w-14',
      )}
    >
      <AuraIcon icon={icon} size={large ? '2xl' : 'xl'} weight="display" className="text-[#E8C872]" />
    </div>
  )
}

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
        <div className="relative flex min-h-[11rem] flex-1 items-center justify-center overflow-hidden border-b border-[#D4AF37]/10 bg-gradient-to-br from-[#120e08] to-[#080604] lg:min-h-[14rem]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.16),transparent_70%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
          <FeatureIconTile icon={icon} large />
        </div>
      ) : (
        <div className="border-b border-[#D4AF37]/10 bg-gradient-to-br from-[#120e08]/80 to-transparent px-6 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div className="relative inline-flex">
            <div className="pointer-events-none absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.2),transparent_70%)] opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
            <FeatureIconTile icon={icon} />
          </div>
        </div>
      )}

      <div className={cn('flex flex-1 flex-col', featured ? 'p-7 sm:p-8' : 'px-6 pb-7 pt-5 sm:px-7 sm:pb-8')}>
        <h3 className="font-display text-lg font-medium tracking-tight text-[#F0E6D2] transition-colors duration-300 group-hover:text-white sm:text-xl">
          {title}
        </h3>
        <p className="mt-3 flex-1 text-sm font-light leading-relaxed lux-text-soft">
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
