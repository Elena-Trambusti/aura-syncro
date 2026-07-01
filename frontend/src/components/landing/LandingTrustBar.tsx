import { useTranslation } from 'react-i18next'
import { LandingSectionDecor } from './landingLuxury'

const TRUST_ITEMS = ['Milano', 'Madrid', 'Barcelona', 'Roma', 'Las Palmas']

export default function LandingTrustBar() {
  const { t } = useTranslation()

  return (
    <section className="relative overflow-hidden border-y border-[#D4AF37]/10 py-14 sm:py-16">
      <LandingSectionDecor />
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-center lux-eyebrow">
          {t('landing.trust.title')}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {TRUST_ITEMS.map(item => (
            <div
              key={item}
              className="group rounded-xl border border-[#D4AF37]/12 bg-gradient-to-b from-[#1a1408]/60 to-[#080604]/80 px-4 py-3.5 text-center text-sm font-medium font-display tracking-wide text-[#C5A059]/70 transition-all duration-300 hover:border-[#D4AF37]/30 hover:text-[#E8C872] hover:shadow-[0_0_20px_rgba(212,175,55,0.08)]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
