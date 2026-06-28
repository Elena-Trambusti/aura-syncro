import { AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { isDemoUserEmail } from '../lib/demoAccounts'

export default function DemoBanner() {
  const { user } = useAuth()
  const { t } = useTranslation()

  if (!isDemoUserEmail(user?.email)) return null

  return (
    <div className="mb-6 rounded-xl border border-aura-gold/30 bg-gradient-to-r from-aura-gold/10 to-slate-900 p-4 shadow-[0_0_20px_rgba(212,175,55,0.15)] backdrop-blur-md">
      <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aura-gold/20 text-aura-gold hidden sm:flex">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-base font-display font-semibold text-aura-gold">
            {t('demo.bannerTitle', 'Benvenuto nella Demo Interattiva di Aura Syncro ⚡️')}
          </p>
          <p className="text-sm text-slate-300 mt-1">
            {t('demo.bannerSubtitle', 'Per testare il sistema, ti consigliamo di andare nella sezione Tavoli: apri un tavolo libero, inserisci una comanda e vedi come tutto si sincronizza istantaneamente. Buon divertimento!')}
          </p>
        </div>
      </div>
    </div>
  )
}
