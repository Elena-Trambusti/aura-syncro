import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/utils'
import { Search, Users, Star, TrendingUp, Award } from 'lucide-react'

interface Customer {
  id: string; name: string; email?: string; phone?: string
  totalVisits: number; totalSpent: number; loyaltyPoints: number
  lastVisit?: string; notes?: string; allergens?: string
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: () => api.get(`/customers${search ? `?search=${search}` : ''}`).then(r => r.data),
  })

  const getSegment = (c: Customer) => {
    if (c.totalVisits >= 10) return { label: 'VIP', color: 'bg-purple-100 text-purple-700' }
    if (c.totalVisits >= 5) return { label: 'Fedele', color: 'bg-blue-100 text-blue-700' }
    if (c.totalVisits >= 2) return { label: 'Abituale', color: 'bg-emerald-100 text-emerald-700' }
    return { label: 'Nuovo', color: 'bg-slate-100 text-slate-600' }
  }

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

      {/* Barra ricerca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          placeholder="Cerca per nome, email, telefono..."
        />
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
                  <p className="text-xs text-blue-700 italic">"{selectedCustomer.notes}"</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
