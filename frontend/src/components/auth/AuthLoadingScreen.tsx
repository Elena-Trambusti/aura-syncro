import { useTranslation } from 'react-i18next'

/** Schermata di attesa finché /auth/me non risolve lo stato tenant (evita flash delle pagine protette). */
export default function AuthLoadingScreen() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[100dvh] items-center justify-center aura-auth-shell">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-aura-gold/30 border-t-aura-gold" />
        <p className="font-medium text-fumo">{t('common.loading', { defaultValue: 'Caricamento…' })}</p>
      </div>
    </div>
  )
}
