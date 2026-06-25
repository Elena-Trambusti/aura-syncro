import { AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function DemoBanner() {
  const { user } = useAuth()

  if (user?.email !== 'admin@demo.it') return null

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 shadow-[0_0_15px_rgba(245,158,11,0.1)] backdrop-blur-md">
      <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 hidden sm:flex">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-200">
            Sei in modalità Demo (Sola Lettura)
          </p>
          <p className="text-xs text-amber-200/80 mt-0.5">
            Puoi esplorare l'interfaccia, ma le azioni di salvataggio e modifica sono disabilitate.
          </p>
        </div>
      </div>
    </div>
  )
}
