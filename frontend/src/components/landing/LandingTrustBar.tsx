import { useTranslation } from 'react-i18next'

export default function LandingTrustBar() {
  const { t } = useTranslation()
  const items = t('landing.trust.items', { returnObjects: true }) as string[]

  return (
    <section
      className="relative border-y border-[#D4AF37]/5 bg-[#020201]/94 py-12 sm:py-14"
      aria-label={t('landing.trust.aria')}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/15 to-transparent" />
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <p className="lux-eyebrow text-[11px] tracking-[0.32em] text-[#F0E6D2] sm:text-xs">
          {t('landing.trust.eyebrow')}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {items.map(item => (
            <span
              key={item}
              className="inline-flex items-center rounded-full border border-[#D4AF37]/12 bg-[#0a0806]/85 px-4 py-2 font-display text-xs font-medium tracking-[0.12em] text-[#F0E6D2] transition-colors duration-300 hover:border-[#D4AF37]/28 sm:px-5 sm:text-sm sm:tracking-wide"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
