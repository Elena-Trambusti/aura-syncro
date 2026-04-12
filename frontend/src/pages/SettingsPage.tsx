import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Save, QrCode, ExternalLink, MonitorCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { restaurant } = useAuth()
  const queryClient = useQueryClient()

  const { data: restaurantData } = useQuery({
    queryKey: ['restaurant'],
    queryFn: () => api.get('/restaurant').then(r => r.data),
  })

  const [form, setForm] = useState({
    name: restaurant?.name || '',
    address: '',
    phone: '',
    email: '',
    description: '',
  })

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (data: typeof form) => api.put('/restaurant', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success('Impostazioni salvate!')
    },
  })

  const menuUrl = `${window.location.origin}/menu/${restaurant?.slug}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`
  const kitchenUrl = `${window.location.origin}/cucina`

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Impostazioni</h1>
        <p className="text-slate-500 text-sm mt-1">Configurazione del tuo ristorante</p>
      </div>

      {/* Info ristorante */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Informazioni Ristorante</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome Ristorante</label>
              <input value={form.name} onChange={e => update('name', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefono</label>
              <input value={form.phone} onChange={e => update('phone', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Indirizzo</label>
              <input value={form.address} onChange={e => update('address', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrizione</label>
              <textarea value={form.description} onChange={e => update('description', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                rows={3} />
            </div>
          </div>
          <button onClick={() => save.mutate(form)} disabled={save.isPending}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" />
            {save.isPending ? 'Salvando...' : 'Salva modifiche'}
          </button>
        </div>
      </div>

      {/* QR Code Menu */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-2">Menu Digitale QR Code</h2>
        <p className="text-sm text-slate-500 mb-4">I tuoi clienti possono scansionare il QR code per vedere il menu digitale</p>
        <div className="flex items-start gap-6">
          <div className="bg-white p-3 border-2 border-slate-100 rounded-xl">
            <img src={qrUrl} alt="QR Menu" className="w-32 h-32" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Link menu pubblico:</p>
              <code className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 block break-all">{menuUrl}</code>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.open(menuUrl, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
                <ExternalLink className="w-4 h-4" />
                Apri menu
              </button>
              <button onClick={() => { navigator.clipboard.writeText(menuUrl); toast.success('Link copiato!') }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-sm font-medium transition-colors">
                <QrCode className="w-4 h-4" />
                Copia link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kitchen Display */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-2">Schermo Cucina (KDS)</h2>
        <p className="text-sm text-slate-500 mb-4">Apri questo link su un tablet o monitor in cucina per visualizzare gli ordini in tempo reale</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 text-xs bg-slate-100 px-3 py-2 rounded-lg text-slate-600 break-all">{kitchenUrl}</code>
          <button
            onClick={() => window.open(kitchenUrl, '_blank')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <MonitorCheck className="w-4 h-4" />
            Apri
          </button>
        </div>
      </div>

      {/* Info account */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Informazioni Account</h2>
        <div className="space-y-2">
          {[
            { label: 'ID Ristorante', value: restaurantData?.id || '—' },
            { label: 'Slug (URL)', value: restaurantData?.slug || '—' },
            { label: 'Database', value: 'SQLite (locale)' },
            { label: 'Versione App', value: '1.0.0 MVP' },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className="text-sm font-medium text-slate-700 font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
