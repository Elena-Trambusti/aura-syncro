import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

const PLANS = ['pro'] as const

export default function LandingPricing() {
  const { t } = useTranslation()

  return (
    <section id="pricing" className="relative bg-transparent px-4 py-24 sm:px-6 sm:py-32 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[700px] w-[700px] rounded-full bg-amber-500/10 blur-[150px]" />
      </div>
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-neutral-400">{t('landing.pricing.title')}</h2>
          <p className="mt-3 text-slate-300">{t('landing.pricing.subtitle')}</p>
        </div>

        <div className="mt-14 mx-auto max-w-md">
          {PLANS.map(plan => {
            const isPro = plan === 'pro'
            const featureKeys = t(`landing.pricing.${plan}.features`, { returnObjects: true }) as string[]
            return (
              <div
                key={plan}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-8',
                  isPro
                    ? 'scale-[1.01] border-white/[0.08] bg-white/[0.02] backdrop-blur-xl text-slate-100 shadow-[0_8_32px_0_rgba(0,0,0,0.37)] transition-all duration-500 hover:scale-[1.02] hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                    : 'border-slate-200 bg-white text-slate-900 shadow-sm',
                )}
              >
                {isPro && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles className="h-3 w-3" />
                    {t('landing.pricing.pro.badge')}
                  </span>
                )}
                <h3 className={cn('text-lg font-bold', isPro ? 'text-white' : 'text-slate-900')}>
                  {t(`landing.pricing.${plan}.name`)}
                </h3>
                <p className={cn('mt-1 text-sm', isPro ? 'text-slate-300' : 'text-slate-500')}>
                  {t(`landing.pricing.${plan}.tagline`)}
                </p>
                <div className="mt-6">
                  <p className={cn('text-3xl font-extrabold', isPro ? 'text-white' : 'text-slate-900')}>
                    {t(`landing.pricing.${plan}.price`)}
                  </p>
                  {t(`landing.pricing.${plan}.setup`, { defaultValue: '' }) && (
                    <p className={cn('mt-1 text-sm', isPro ? 'text-slate-300' : 'text-slate-600')}>
                      {t(`landing.pricing.${plan}.setup`)}
                    </p>
                  )}
                </div>
                <ul className="mt-8 flex-1 space-y-3">
                  {Array.isArray(featureKeys) && featureKeys.map(line => (
                    <li key={line} className={cn('flex items-start gap-2 text-sm', isPro ? 'text-slate-200' : 'text-slate-700')}>
                      <Check className={cn('mt-0.5 h-4 w-4 shrink-0', isPro ? 'text-amber-300' : 'text-amber-600')} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={cn(
                    'mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition-colors',
                    isPro
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all animate-[pulse_3s_ease-in-out_infinite]'
                      : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                  )}
                >
                  {t('landing.pricing.cta')}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
