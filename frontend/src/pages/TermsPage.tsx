import { Link } from 'react-router-dom'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Termini di Servizio</h1>
        <p className="text-slate-600">Aura Syncro è un software gestionale in abbonamento per ristoranti.</p>
        <p className="text-slate-600">L'attivazione prevede setup iniziale e canone mensile. Il servizio include supporto e onboarding concierge.</p>
        <p className="text-slate-600">L'utente è responsabile dei contenuti inseriti e del rispetto delle normative fiscali e privacy locali.</p>
        <Link to="/prezzi" className="inline-block rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Torna ai prezzi</Link>
      </div>
    </div>
  )
}