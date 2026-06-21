import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

/** Paywall per moduli riservati al piano Pro (tenant già abbonato). */
export default function ProPaywall() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
          <Sparkles className="h-8 w-8 text-violet-600" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
          {t('paywall.proBadge')}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{t('paywall.proTitle')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('paywall.proDescription')}</p>
        <ul className="mt-6 space-y-2 text-left text-sm text-slate-600">
          {(['proFeature1', 'proFeature2', 'proFeature3'] as const).map(key => (
            <li key={key} className="flex items-start gap-2">
              <span className="mt-1 text-violet-500">✓</span>
              {t(`paywall.${key}`)}
            </li>
          ))}
        </ul>
        <a
          href="mailto:elenatrambusti2024@gmail.com?subject=Upgrade%20Aura%20Syncro%20Pro"
          className="mt-8 inline-block w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          {t('paywall.proCta')}
        </a>
      </div>
    </div>
  )
}
