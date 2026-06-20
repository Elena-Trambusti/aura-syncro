import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatTime, RESERVATION_STATUS_LABELS } from '../lib/utils'
import { Plus, Users, Phone, CalendarDays, XCircle, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface Reservation {
  id: string; guestName: string; guestPhone: string; guestEmail?: string
  covers: number; date: string; duration: number; status: string
  notes?: string; table?: { number: number }
  customer?: { totalVisits: number }
}

function ReservationForm({ onSave, onCancel }: { onSave: (data: Record<string, string | number>) => void; onCancel: () => void }) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const [form, setForm] = useState({
    guestName: '', guestPhone: '', guestEmail: '',
    covers: 2, date: tomorrow.toISOString().slice(0, 16),
    duration: 90, notes: '',
  })
  const update = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-stone-900/55 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-stone-100 mb-5">Nuova Prenotazione</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-200 mb-1">Nome ospite *</label>
              <input value={form.guestName} onChange={e => update('guestName', e.target.value)}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35"
                placeholder="Mario Rossi" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1">Telefono *</label>
              <input value={form.guestPhone} onChange={e => update('guestPhone', e.target.value)}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35"
                placeholder="+39 333..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1">Coperti *</label>
              <input type="number" min={1} max={20} value={form.covers} onChange={e => update('covers', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-200 mb-1">Data e ora *</label>
              <input type="datetime-local" value={form.date} onChange={e => update('date', e.target.value)}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1">Email</label>
              <input type="email" value={form.guestEmail} onChange={e => update('guestEmail', e.target.value)}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-200 mb-1">Durata (min)</label>
              <select value={form.duration} onChange={e => update('duration', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35">
                <option value={60}>1 ora</option>
                <option value={90}>1.5 ore</option>
                <option value={120}>2 ore</option>
                <option value={150}>2.5 ore</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-200 mb-1">Note</label>
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)}
                className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35 resize-none"
                rows={2} placeholder="Allergie, occasioni speciali..." />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-stone-700/50 rounded-xl text-sm font-medium">Annulla</button>
          <button onClick={() => onSave({ ...form, date: new Date(form.date).toISOString() })}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold">
            Conferma Prenotazione
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReservationsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: ['reservations', selectedDate],
    queryFn: () => api.get(`/reservations?date=${selectedDate}`).then(r => r.data),
    refetchInterval: 30_000,
  })

  const createReservation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/reservations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      setShowForm(false)
      toast.success('Prenotazione confermata!')
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/reservations/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  })

  const totalCovers = reservations.filter(r => !['CANCELLED', 'NO_SHOW'].includes(r.status)).reduce((s, r) => s + r.covers, 0)

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    SEATED: 'bg-emerald-100 text-emerald-800',
    COMPLETED: 'bg-stone-800/50 text-stone-300',
    CANCELLED: 'bg-red-100 text-red-600',
    NO_SHOW: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Prenotazioni</h1>
          <p className="text-stone-400 text-sm mt-1">{reservations.length} prenotazioni · {totalCovers} coperti previsti</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Nuova Prenotazione
        </button>
      </div>

      {/* Selettore data */}
      <div className="flex items-center gap-3">
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35 bg-stone-900/55 text-stone-200" />
        <div className="flex gap-2">
          {[-1, 0, 1].map(offset => {
            const d = new Date(); d.setDate(d.getDate() + offset)
            const dateStr = d.toISOString().split('T')[0]
            const labels = ['Ieri', 'Oggi', 'Domani']
            return (
              <button key={offset} onClick={() => setSelectedDate(dateStr)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${selectedDate === dateStr ? 'bg-amber-600 text-white' : 'bg-stone-900/55 border border-stone-700/50 text-stone-300'}`}>
                {labels[offset + 1]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista prenotazioni */}
      <div className="space-y-3">
        {reservations.map(res => (
          <div key={res.id} className={`bg-stone-900/55 rounded-2xl p-4 border border-stone-800/50 shadow-sm flex items-center gap-4 ${['CANCELLED', 'NO_SHOW'].includes(res.status) ? 'opacity-60' : ''}`}>
            <div className="w-14 h-14 rounded-xl bg-amber-950/30 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-bold text-amber-400">{formatTime(res.date)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-stone-100">{res.guestName}</p>
                {res.customer && res.customer.totalVisits > 3 && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">VIP</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[res.status]}`}>
                  {RESERVATION_STATUS_LABELS[res.status]}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-stone-400">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{res.covers} pers.</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{res.duration} min</span>
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{res.guestPhone}</span>
                {res.table && <span className="text-amber-400 font-medium">T{res.table.number}</span>}
              </div>
              {res.notes && <p className="text-xs text-stone-500 mt-1 italic">"{res.notes}"</p>}
            </div>
            <div className="flex items-center gap-2">
              {res.status === 'CONFIRMED' && (
                <button onClick={() => updateStatus.mutate({ id: res.id, status: 'SEATED' })}
                  className="p-2 bg-emerald-950/40 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors" title="Al tavolo">
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              {!['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(res.status) && (
                <button onClick={() => updateStatus.mutate({ id: res.id, status: 'CANCELLED' })}
                  className="p-2 hover:bg-red-950/30 text-stone-500 hover:text-red-500 rounded-lg transition-colors" title="Annulla">
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {reservations.length === 0 && (
          <div className="flex flex-col items-center py-16 text-stone-500">
            <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Nessuna prenotazione per questa data</p>
          </div>
        )}
      </div>

      {showForm && (
        <ReservationForm
          onSave={data => createReservation.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
