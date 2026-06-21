import { useTranslation } from 'react-i18next'

/** Schermata di attesa finché /auth/me non risolve lo stato tenant (evita flash delle pagine protette). */
export default function AuthLoadingScreen() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="font-medium text-slate-700">{t('common.loading')}</p>
      </div>
    </div>
  )
}
