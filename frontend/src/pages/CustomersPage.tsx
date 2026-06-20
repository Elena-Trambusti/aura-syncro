import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import { Search, Users, Star, TrendingUp, Award, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface Customer {
  id: string; name: string; email?: string; phone?: string
  totalVisits: number; totalSpent: number; loyaltyPoints: number
  lastVisit?: string; notes?: string; allergens?: string
}

interface NewCustomerForm {
  name: string
  email: string
  phone: string
  notes: string
}

const emptyForm = (): NewCustomerForm => ({ name: '', email: '', phone: '', notes: '' })

export default function CustomersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState<NewCustomerForm>(emptyForm)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers${search ? `?search=${search}` : ''}`).then(r => r.data),
  })

  const createCustomer = useMutation({
    mutationFn: (data: NewCustomerForm) =>
      api.post('/customers', {
        name: data.name.trim(),
        ...(data.email.trim() ? { email: data.email.trim() } : {}),
        ...(data.phone.trim() ? { phone: data.phone.trim() } : {}),
        ...(data.notes.trim() ? { notes: data.notes.trim() } : {}),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      setShowCreateModal(false)
      setForm(emptyForm())
      setSelectedCustomer(res.data)
      toast.success('Cliente creato con successo')
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || 'Errore durante il salvataggio')
    },
  })

  const openCreateModal = () => {
    setForm(emptyForm())
    setShowCreateModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Il nome è obbligatorio')
      return
    }
    createCustomer.mutate(form)
  }

  const getSegment = (c: Customer) => {
    if (c.totalVisits >= 10) return { label: 'VIP', color: 'bg-purple-100 text-purple-700' }
    if (c.totalVisits >= 5) return { label: 'Fedele', color: 'bg-blue-100 text-blue-700' }
    if (c.totalVisits >= 2) return { label: 'Abituale', color: 'bg-emerald-100 text-emerald-700' }
    return { label: 'Nuovo', color: 'bg-slate-100 text-slate-600' }
  }

  const inputClass =
    'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Clienti CRM</h1>
        <p className="text-slate-500 text-sm mt-1">{customers.length} clienti nel database</p>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Totale', value: customers.length, icon: Users, color: 'bg-slate-500' },
          { label: 'VIP (10+ visite)', value: customers.filter(c => c.totalVisits >= 10).length, icon: Award, color: 'bg-purple-500' },
          { label: 'Fedeli (5+ visite)', value: customers.filter(c => c.totalVisits >= 5).length, icon: Star, color: 'bg-blue-500' },
          { label: 'Spesa media', value: formatCurrency(customers.reduce((s, c) => s + c.totalSpent, 0) / Math.max(1, customers.length)), icon: TrendingUp, color: 'bg-emerald-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{s.label}</p>
                <p className="text-xl font-bold text-slate-800 mt-1">{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ricerca + Nuovo cliente */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            placeholder="Cerca per nome, email, telefono..."
          />
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuovo Cliente
        </button>
      </div>

      <div className="flex gap-4">
        {/* Lista clienti */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Cliente</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Segmento</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Visite</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Tot. speso</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Punti</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Ultima visita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {customers.map(customer => {
                const segment = getSegment(customer)
                return (
                  <tr key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="hover:bg-orange-50 cursor-pointer transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
                        <p className="text-xs text-slate-400">{customer.email || customer.phone || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${segment.color}`}>{segment.label}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 font-medium">{customer.totalVisits}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{formatCurrency(customer.totalSpent)}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full font-medium">
                        ⭐ {customer.loyaltyPoints}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">
                      {customer.lastVisit ? formatDate(customer.lastVisit) : 'Mai'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Users className="w-10 h-10 mb-2 opacity-30" />
              <p>Nessun cliente trovato</p>
            </div>
          )}
        </div>

        {/* Dettaglio cliente */}
        {selectedCustomer && (
          <div className="w-72 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-400">{selectedCustomer.email}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Telefono', value: selectedCustomer.phone || '—' },
                { label: 'Visite totali', value: selectedCustomer.totalVisits },
                { label: 'Totale speso', value: formatCurrency(selectedCustomer.totalSpent) },
                { label: 'Punti fedeltà', value: `⭐ ${selectedCustomer.loyaltyPoints}` },
                { label: 'Ultima visita', value: selectedCustomer.lastVisit ? formatDate(selectedCustomer.lastVisit) : 'Mai' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-medium text-slate-700">{row.value}</span>
                </div>
              ))}
              {selectedCustomer.allergens && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs font-medium text-red-700">⚠ Allergie: {selectedCustomer.allergens}</p>
                </div>
              )}
              {selectedCustomer.notes && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700 italic">&quot;{selectedCustomer.notes}&quot;</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modale nuovo cliente */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !createCustomer.isPending && setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800">Nuovo Cliente</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome e Cognome <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className={inputClass}
                  placeholder="es. Mario Rossi"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className={inputClass}
                  placeholder="mario@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className={inputClass}
                  placeholder="+34 600 000 000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Note / Preferenze</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Intolleranze, tavolo preferito, occasioni speciali..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createCustomer.isPending}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={createCustomer.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {createCustomer.isPending ? 'Salvataggio...' : 'Salva Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
