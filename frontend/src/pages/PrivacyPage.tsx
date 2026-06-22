import { Link } from 'react-router-dom'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="text-slate-600">Aura Syncro tratta i dati dei clienti e del ristorante esclusivamente per erogare il servizio SaaS.</p>
        <p className="text-slate-600">I dati sono conservati su infrastruttura cloud sicura e accessibili solo a personale autorizzato.</p>
        <p className="text-slate-600">Per richieste su dati personali: <a className="text-amber-700 underline" href="mailto:aurasyncro@gmail.com">aurasyncro@gmail.com</a>.</p>
        <Link to="/prezzi" className="inline-block rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Torna ai prezzi</Link>
      </div>
    </div>
  )
}