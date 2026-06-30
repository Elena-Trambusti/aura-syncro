import { useTranslation } from 'react-i18next'
import { UtensilsCrossed, QrCode, CreditCard, Scale, BrainCircuit, Users, type LucideIcon } from 'lucide-react'
import AuraIcon from '../ui/AuraIcon'

const FEATURES: Array<{ key: string; icon: LucideIcon; className: string }> = [
  { key: 'tables', icon: UtensilsCrossed, className: 'lg:col-span-2 lg:row-span-2' },
  { key: 'qrMenu', icon: QrCode, className: '' },
  { key: 'stripe', icon: CreditCard, className: '' },
  { key: 'fiscal', icon: Scale, className: 'lg:col-span-2' },
  { key: 'crm', icon: Users, className: 'lg:col-span-2' },
  { key: 'ai', icon: BrainCircuit, className: 'lg:col-span-2' },
]

export default function LandingFeatures() {
  const { t } = useTranslation()

  return (
    <section id="features" className="relative bg-transparent px-4 py-24 sm:px-6 sm:py-28 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[800px] w-[800px] rounded-full bg-amber-500/10 blur-[150px]" />
      </div>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="lux-heading text-[#C5A059] text-3xl font-bold tracking-tighter sm:text-4xl">{t('landing.features.title')}</h2>
          <p className="mt-3 text-slate-300">{t('landing.features.subtitle')}</p>
        </div>
        <div className="mt-12 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon, className }) => (
            <div
              key={key}
              className={`rounded-2xl border border-[#D4AF37]/10 bg-[#0a0a0a]/95 p-6 shadow-sm transition-all duration-300 hover:border-[#D4AF37]/25 hover:shadow-[0_0_24px_rgba(212,175,55,0.08)] ${className}`}
            >
              <div className="mb-4 inline-flex rounded-xl border border-[#D4AF37]/15 bg-[#080604]/80 p-3">
                <AuraIcon icon={icon} size="xl" weight="display" className="text-[#E8C872]" />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                {t(`landing.features.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {t(`landing.features.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
