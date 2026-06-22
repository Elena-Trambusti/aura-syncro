import { Link } from 'react-router-dom'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Aura Syncro — Prezzi</h1>
        <p className="text-slate-600">Un solo piano, tutto incluso.</p>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Premium All-Inclusive</h2>
          <p className="mt-2 text-slate-700"><strong>€500</strong> setup iniziale (una tantum)</p>
          <p className="text-slate-700"><strong>€199/mese</strong> canone ricorrente</p>
          <p className="mt-2 text-slate-600">CRM, AI, marketing, fedeltà, analytics, report fiscal, pagamenti digitali inclusi.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/register" className="rounded-xl bg-amber-500 px-5 py-2.5 font-semibold text-white hover:bg-amber-600">Inizia ora</Link>
          <Link to="/login" className="rounded-xl border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100">Accedi</Link>
          <Link to="/privacy" className="rounded-xl border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100">Privacy</Link>
          <Link to="/termini" className="rounded-xl border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100">Termini</Link>
        </div>
      </div>
    </div>
  )
}