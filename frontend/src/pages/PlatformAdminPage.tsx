import { useCallback, useEffect, useState } from 'react'
import { Loader2, Shield, Users, RefreshCw, LogOut, Unlock, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import {
  clearStoredAdminKey,
  completeSetup,
  fetchPendingSetup,
  fetchRegistrations,
  getStoredAdminKey,
  setStoredAdminKey,
  deleteRestaurant,
  type PendingSetupRestaurant,
  type PlatformRegistration,
} from '../lib/platformAdmin'
import { BRAND } from '../lib/brand'
import { Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'

type FilterMode = 'today' | 'all'
type ViewMode = 'registrations' | 'pending'

function ownerEmailOf(r: PendingSetupRestaurant): string | undefined {
  return r.users[0]?.email
}

export default function PlatformAdminPage() {
  const [adminKey, setAdminKey] = useState(getStoredAdminKey() ?? '')
  const [inputKey, setInputKey] = useState('')
  const [authenticated, setAuthenticated] = useState(!!getStoredAdminKey())
  const [view, setView] = useState<ViewMode>('pending')
  const [filter, setFilter] = useState<FilterMode>('today')
  const [registrations, setRegistrations] = useState<PlatformRegistration[]>([])
  const [pending, setPending] = useState<PendingSetupRestaurant[]>([])
  const [meta, setMeta] = useState<{ count: number; date?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const parseAdminError = useCallback((err: unknown): { msg: string; status?: number } => {
    const axiosErr = err as { response?: { status?: number; data?: { error?: string } }; message?: string }
    const status = axiosErr.response?.status
    const apiError = axiosErr.response?.data?.error
    let msg = apiError ?? 'Operazione non riuscita.'
    if (status === 401) {
      msg = 'Chiave admin non valida. Usa la stessa ADMIN_API_KEY impostata su DigitalOcean.'
    } else if (status === 404) {
      msg = 'Endpoint non disponibile: avvia un Redeploy su DigitalOcean e riprova.'
    } else if (status === 503) {
      msg = 'ADMIN_API_KEY non configurata sul server DigitalOcean.'
    } else if (!status) {
      msg = 'Backend non raggiungibile.'
    }
    return { msg, status }
  }, [])

  const loadRegistrations = useCallback(async (key: string, mode: FilterMode) => {
    const data = await fetchRegistrations(key, {
      today: mode === 'today',
      limit: mode === 'today' ? 100 : 50,
    })
    setRegistrations(data.registrations)
    setMeta({ count: data.count, date: data.filter.date })
  }, [])

  const loadPending = useCallback(async (key: string) => {
    const data = await fetchPendingSetup(key)
    setPending(data.restaurants)
  }, [])

  const loadAll = useCallback(async (key: string, mode: FilterMode) => {
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await Promise.all([loadRegistrations(key, mode), loadPending(key)])
    } catch (err: unknown) {
      const { msg, status } = parseAdminError(err)
      setError(msg)
      if (status === 401) {
        clearStoredAdminKey()
        setAuthenticated(false)
        setAdminKey('')
      }
    } finally {
      setLoading(false)
    }
  }, [loadPending, loadRegistrations, parseAdminError])

  useEffect(() => {
    if (authenticated && adminKey) {
      void loadAll(adminKey, filter)
    }
  }, [authenticated, adminKey, filter, loadAll])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputKey.trim()
    if (!trimmed) return
    setStoredAdminKey(trimmed)
    setAdminKey(trimmed)
    setAuthenticated(true)
  }

  const handleLogout = () => {
    clearStoredAdminKey()
    setAuthenticated(false)
    setAdminKey('')
    setInputKey('')
    setRegistrations([])
    setPending([])
  }

  const handleUnlock = async (restaurant: PendingSetupRestaurant | PlatformRegistration) => {
    const isRegistration = 'userId' in restaurant
    const email = isRegistration ? restaurant.email : ownerEmailOf(restaurant)
    const id = isRegistration ? restaurant.restaurantId : restaurant.id

    if (!email) {
      setError('Email owner non disponibile per questo ristorante.')
      return
    }

    setUnlockingId(id)
    setError(null)
    setSuccessMsg(null)
    try {
      const result = await completeSetup(adminKey, { ownerEmail: email })
      setSuccessMsg(`Dashboard sbloccata per ${result.restaurant.name}`)
      await loadAll(adminKey, filter)
    } catch (err: unknown) {
      const { msg } = parseAdminError(err)
      setError(msg)
    } finally {
      setUnlockingId(null)
    }
  }

  const handleDelete = async (restaurantId: string, restaurantName: string) => {
    const confirmation = await toast.prompt({
      title: 'Eliminazione definitiva',
      description: `Stai per eliminare "${restaurantName}" e tutti i suoi dati. Scrivi ELIMINA per confermare.`,
      defaultValue: '',
      placeholder: 'ELIMINA',
      confirmLabel: 'Elimina ristorante',
      cancelLabel: 'Annulla',
      validate: value =>
        value === 'ELIMINA' ? null : 'Scrivi esattamente ELIMINA per confermare',
    })
    if (confirmation !== 'ELIMINA') {
      toast.message('Eliminazione annullata')
      return
    }

    setDeletingId(restaurantId)
    setError(null)
    setSuccessMsg(null)
    try {
      const result = await deleteRestaurant(adminKey, restaurantId)
      setSuccessMsg(result.message)
      await loadAll(adminKey, filter)
    } catch (err: unknown) {
      const { msg } = parseAdminError(err)
      setError(msg)
    } finally {
      setDeletingId(null)
    }
  }

  const canUnlock = (r: PlatformRegistration) =>
    r.hasActiveSubscription && !r.isSetupComplete

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-amber-400" />
            <div>
              <h1 className="text-xl font-bold text-white">{BRAND.name} — Admin</h1>
              <p className="text-sm text-stone-400">Accesso piattaforma (solo team Aura Syncro)</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1.5">Chiave admin</label>
              <input
                type="password"
                value={inputKey}
                onChange={e => setInputKey(e.target.value)}
                className="w-full rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-aura-gold/30"
                placeholder="ADMIN_API_KEY"
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 font-semibold text-sm"
            >
              Accedi
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="font-bold">Admin piattaforma</h1>
              <p className="text-xs text-stone-400">Iscrizioni e sblocco concierge</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll(adminKey, filter)}
              disabled={loading}
              className="p-2 rounded-lg border border-stone-700 hover:bg-stone-800 disabled:opacity-50"
              title="Aggiorna"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg border border-stone-700 hover:bg-stone-800"
              title="Esci"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView('pending')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
              view === 'pending'
                ? 'bg-aura-gold text-stone-950'
                : 'border border-stone-700 text-stone-300 hover:bg-stone-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Da sbloccare ({pending.length})
          </button>
          <button
            type="button"
            onClick={() => setView('registrations')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === 'registrations'
                ? 'bg-aura-gold text-stone-950'
                : 'border border-stone-700 text-stone-300 hover:bg-stone-800'
            }`}
          >
            Iscrizioni
          </button>
        </div>

        {successMsg && (
          <p className="text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800 rounded-xl px-4 py-3">
            {successMsg}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {view === 'pending' && (
          <section>
            <p className="text-stone-400 text-sm mb-4">
              Clienti che hanno pagato e aspettano il tuo sblocco dopo onboarding.
            </p>
            {loading && pending.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              </div>
            ) : pending.length === 0 ? (
              <div className="rounded-xl border border-stone-800 bg-stone-900 p-8 text-center text-stone-400">
                Nessun cliente in attesa di sblocco.
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map(r => {
                  const owner = ownerEmailOf(r)
                  return (
                    <article key={r.id} className="premium-card p-5 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-aura-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex flex-wrap items-start justify-between gap-3 relative z-10">
                        <div>
                          <p className="font-semibold text-white">{r.name}</p>
                          <p className="text-sm text-amber-400/90">{owner ?? '—'}</p>
                          <p className="text-xs text-stone-500 mt-1">
                            Piano {r.settings?.planTier ?? 'BASE'} · slug: {r.slug}
                          </p>
                        </div>
                        <div className="flex gap-2 items-center">
                          {r.settings?.onboardingIntake && (
                            <button
                              type="button"
                              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#222222] border border-[#333333] text-stone-300 hover:text-white px-3 py-2 text-sm font-semibold transition-all"
                            >
                              <FileText className="w-4 h-4" />
                              Dati Onboarding
                              {expandedId === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={deletingId === r.id}
                            onClick={() => void handleDelete(r.id, r.name)}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-400 px-3 py-2 text-sm font-semibold transition-all"
                            title="Elimina"
                          >
                            {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            disabled={unlockingId === r.id || !owner}
                            onClick={() => void handleUnlock(r)}
                            className="inline-flex items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 disabled:opacity-50 px-4 py-2 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                          >
                            {unlockingId === r.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                            Sblocca dashboard
                          </button>
                        </div>
                      </div>
                      
                      {expandedId === r.id && r.settings?.onboardingIntake && (
                        <div className="mt-4 pt-4 border-t border-stone-800 bg-[#111111] -mx-5 -mb-5 px-5 pb-5 rounded-b-xl overflow-x-auto text-sm">
                          <p className="text-stone-400 mb-2 font-semibold">Modulo inviato il: {r.settings.onboardingSubmittedAt ? new Date(r.settings.onboardingSubmittedAt).toLocaleString('it-IT') : 'N/D'}</p>
                          <pre className="text-stone-300 font-mono text-xs whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
                            {JSON.stringify(r.settings.onboardingIntake, null, 2)}
                          </pre>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {view === 'registrations' && (
          <section>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setFilter('today')}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  filter === 'today' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                Oggi
              </button>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  filter === 'all' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-white'
                }`}
              >
                Ultime 50
              </button>
            </div>

            {loading && registrations.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="rounded-xl border border-stone-800 bg-stone-900 p-8 text-center text-stone-400">
                {filter === 'today' ? 'Nessuna iscrizione oggi.' : 'Nessuna iscrizione trovata.'}
              </div>
            ) : (
              <>
                <p className="text-stone-400 text-sm mb-4">
                  {filter === 'today'
                    ? `${meta?.count ?? 0} iscrizioni oggi${meta?.date ? ` (${meta.date})` : ''}`
                    : `${meta?.count ?? 0} iscrizioni recenti`}
                </p>
                <div className="space-y-3">
                  {registrations.map(r => (
                    <article key={r.userId} className="premium-card p-5 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-aura-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2 relative z-10">
                        <div>
                          <p className="font-semibold text-white">{r.ownerName}</p>
                          <p className="text-sm text-amber-400/90">{r.email}</p>
                        </div>
                        <time className="text-xs text-stone-500">{r.registeredAtRome}</time>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                        <div>
                          <dt className="text-stone-500 inline">Ristorante: </dt>
                          <dd className="inline text-stone-200">{r.restaurantName}</dd>
                        </div>
                        {r.phone && (
                          <div>
                            <dt className="text-stone-500 inline">Tel: </dt>
                            <dd className="inline text-stone-200">{r.phone}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-stone-500 inline">Piano: </dt>
                          <dd className="inline text-stone-200">
                            {r.planTier}
                            {r.hasActiveSubscription ? ' · abbonato' : ' · free'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500 inline">Setup: </dt>
                          <dd className="inline text-stone-200">
                            {r.isSetupComplete ? 'completo' : 'in attesa'}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex justify-end gap-2 relative z-10">
                        {r.onboardingIntake && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expandedId === r.restaurantId ? null : r.restaurantId)}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#222222] border border-[#333333] text-stone-300 hover:text-white px-3 py-2 text-sm font-semibold transition-all mr-auto"
                          >
                            <FileText className="w-4 h-4" />
                            Dati Onboarding
                            {expandedId === r.restaurantId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === r.restaurantId}
                          onClick={() => void handleDelete(r.restaurantId, r.restaurantName)}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-400 px-3 py-2 text-sm font-semibold transition-all"
                          title="Elimina"
                        >
                          {deletingId === r.restaurantId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                        {canUnlock(r) && (
                          <button
                            type="button"
                            disabled={unlockingId === r.restaurantId}
                            onClick={() => void handleUnlock(r)}
                            className="inline-flex items-center gap-2 rounded-xl bg-aura-gold hover:bg-aura-gold-light text-stone-950 disabled:opacity-50 px-4 py-2 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                          >
                            {unlockingId === r.restaurantId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                            Sblocca dashboard
                          </button>
                        )}
                      </div>

                      {expandedId === r.restaurantId && r.onboardingIntake && (
                        <div className="mt-4 pt-4 border-t border-stone-800 bg-[#111111] -mx-5 -mb-5 px-5 pb-5 rounded-b-xl overflow-x-auto text-sm">
                          <p className="text-stone-400 mb-2 font-semibold">Modulo inviato il: {r.onboardingSubmittedAt ? new Date(r.onboardingSubmittedAt).toLocaleString('it-IT') : 'N/D'}</p>
                          <pre className="text-stone-300 font-mono text-xs whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
                            {JSON.stringify(r.onboardingIntake, null, 2)}
                          </pre>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
