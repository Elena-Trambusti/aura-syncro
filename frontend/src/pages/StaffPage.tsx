import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { ROLE_LABELS, getInitials } from '../lib/utils'
import { Plus, Calendar, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'

interface StaffMember { id: string; name: string; email: string; role: string; phone?: string; active: boolean }
interface Shift {
  id: string; date: string; startTime: string; endTime: string
  role?: string; status: string; notes?: string
  user: { id: string; name: string; role: string }
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  WAITER: 'bg-emerald-950/50 text-emerald-400',
  KITCHEN: 'bg-amber-950/40 text-amber-400',
  CASHIER: 'bg-stone-800/50 text-stone-200',
}

export default function StaffPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'staff' | 'shifts'>('staff')
  const [showForm, setShowForm] = useState(false)
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'WAITER', phone: '' })

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: () => api.get('/staff').then(r => r.data),
  })

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['shifts'],
    queryFn: () => api.get('/staff/shifts').then(r => r.data),
  })

  const createStaff = useMutation({
    mutationFn: (data: typeof newStaff) => api.post('/staff', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowForm(false)
      setNewStaff({ name: '', email: '', password: '', role: 'WAITER', phone: '' })
      toast.success(t('staff.memberAdded'))
    },
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.put(`/staff/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  })

  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + i)
    return d
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="aura-page-title">{t('staff.title')}</h1>
          <p className="aura-page-subtitle">{t('staff.subtitle')}</p>
        </div>
        {tab === 'staff' && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" />
            Aggiungi
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {[{ key: 'staff', label: 'Squadra', icon: UserCog }, { key: 'shifts', label: 'Turni Settimanali', icon: Calendar }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as 'staff' | 'shifts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-amber-600 text-white' : 'glass-chip text-stone-300'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'staff' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map(member => (
            <div key={member.id} className={`glass-card p-5 ${!member.active ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-950/40 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-amber-400">{getInitials(member.name)}</span>
                </div>
                <div>
                  <p className="font-semibold text-stone-100">{member.name}</p>
                  <p className="text-xs text-stone-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                  {ROLE_LABELS[member.role]}
                </span>
                {member.role !== 'OWNER' && (
                  <button
                    onClick={() => toggleActive.mutate({ id: member.id, active: !member.active })}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${member.active ? 'border-emerald-300 text-emerald-600 hover:bg-red-950/30 hover:text-red-600 hover:border-red-300' : 'border-stone-700/50 text-stone-400 hover:bg-emerald-950/30 hover:text-emerald-600'}`}
                  >
                    {member.active ? 'Attivo' : 'Inattivo'}
                  </button>
                )}
              </div>
              {member.phone && <p className="text-xs text-stone-500 mt-2">📞 {member.phone}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'shifts' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-stone-800/50 glass-table-head">
                  <th className="text-left text-xs font-semibold text-stone-400 uppercase px-5 py-3 w-36">Dipendente</th>
                  {daysOfWeek.map(d => (
                    <th key={d.toISOString()} className="text-center text-xs font-semibold text-stone-400 uppercase px-2 py-3">
                      <div className={`${d.toDateString() === new Date().toDateString() ? 'text-amber-400' : ''}`}>
                        {d.toLocaleDateString('it-IT', { weekday: 'short' })}
                        <br />
                        {d.getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/40">
                {staff.filter(s => s.active && s.role !== 'OWNER').map(member => (
                  <tr key={member.id} className="hover:glass-table-head">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-amber-950/40 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-amber-400">{getInitials(member.name)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-stone-200">{member.name.split(' ')[0]}</p>
                          <p className="text-xs text-stone-500">{ROLE_LABELS[member.role]}</p>
                        </div>
                      </div>
                    </td>
                    {daysOfWeek.map(d => {
                      const dayShifts = shifts.filter(s =>
                        s.user.id === member.id &&
                        new Date(s.date).toDateString() === d.toDateString()
                      )
                      return (
                        <td key={d.toISOString()} className="px-2 py-3 text-center">
                          {dayShifts.map(shift => (
                            <div key={shift.id} className="bg-amber-950/40 text-amber-400 text-xs px-2 py-1 rounded-lg mb-1">
                              {shift.startTime}–{shift.endTime}
                            </div>
                          ))}
                          {dayShifts.length === 0 && <span className="text-stone-300">—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shifts.length === 0 && (
            <div className="text-center py-8 text-stone-500">
              <Calendar className="w-10 h-10 mb-2 mx-auto opacity-30" />
              <p>Nessun turno programmato questa settimana</p>
            </div>
          )}
        </div>
      )}

      {/* Form nuovo membro */}
      {showForm && (
        <div className="glass-overlay flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-modal p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-100 mb-5">Aggiungi Membro del Team</h3>
            <div className="space-y-4">
              {[
                { label: 'Nome completo *', key: 'name', type: 'text', placeholder: 'Mario Rossi' },
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'mario@ristorante.it' },
                { label: 'Password temporanea *', key: 'password', type: 'password', placeholder: 'Minimo 6 caratteri' },
                { label: 'Telefono', key: 'phone', type: 'tel', placeholder: '+39 333...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-stone-200 mb-1">{f.label}</label>
                  <input type={f.type} value={(newStaff as Record<string, string>)[f.key]}
                    onChange={e => setNewStaff(s => ({ ...s, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-stone-200 mb-1">Ruolo *</label>
                <select value={newStaff.role} onChange={e => setNewStaff(s => ({ ...s, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-stone-700/60 rounded-xl bg-stone-950/70 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/35">
                  {['MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'].map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-stone-700/50 rounded-xl text-sm font-medium">Annulla</button>
              <button onClick={() => createStaff.mutate(newStaff)}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold">
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
