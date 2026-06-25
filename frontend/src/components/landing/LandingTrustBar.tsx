import { useTranslation } from 'react-i18next'

const TRUST_ITEMS = ['Milano', 'Madrid', 'Barcelona', 'Roma', 'Las Palmas']

export default function LandingTrustBar() {
  const { t } = useTranslation()

  return (
    <section className="relative border-t border-white/5 bg-transparent px-4 py-12 sm:px-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {t('landing.trust.title')}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-slate-400 sm:grid-cols-3 lg:grid-cols-5">
          {TRUST_ITEMS.map(item => (
            <div
              key={item}
              className="rounded-xl border border-white/[0.08] px-4 py-3 text-center text-sm font-semibold grayscale transition hover:grayscale-0"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
