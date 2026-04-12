import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import { CheckCircle2, ChefHat, ArrowLeft, Loader2 } from 'lucide-react'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  menuItem: { name: string }
}

interface SessionData {
  status: string
  amount: number
  customerEmail?: string
  order?: {
    id: string
    total: number
    type: string
    table?: { number: number }
    items: OrderItem[]
  }
}

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const [data, setData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(!!sessionId)
  const [error, setError] = useState(!sessionId)

  useEffect(() => {
    if (!sessionId) return
    api.get(`/payments/session/${sessionId}`)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [sessionId])

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-slate-500">Verifica pagamento...</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✗</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Pagamento non confermato</h2>
        <p className="text-slate-500 mb-6">Non riusciamo a verificare il tuo pagamento. Mostra lo screenshot al cameriere.</p>
        <Link to="/" className="text-orange-500 font-semibold hover:underline">Torna al menu</Link>
      </div>
    </div>
  )

  const isPaid = data.status === 'paid'

  return (
    <div className="min-h-screen bg-slate-50 max-w-lg mx-auto">
      {/* Header */}
      <div className={`px-5 pt-10 pb-8 text-white text-center ${isPaid ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
          {isPaid
            ? <CheckCircle2 className="w-10 h-10 text-white" />
            : <ChefHat className="w-10 h-10 text-white" />
          }
        </div>
        <h1 className="text-2xl font-black mb-1">
          {isPaid ? 'Pagamento confermato!' : 'Pagamento in elaborazione'}
        </h1>
        <p className="text-white/80 text-sm">
          {isPaid
            ? 'Il tuo ordine è stato inviato alla cucina'
            : 'Il pagamento è in corso di verifica'
          }
        </p>
        {data.amount > 0 && (
          <div className="mt-4 bg-white/20 rounded-2xl px-6 py-3 inline-block">
            <span className="text-3xl font-black">{formatCurrency(data.amount)}</span>
          </div>
        )}
      </div>

      {/* Dettagli ordine */}
      {data.order && (
        <div className="px-5 py-6 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">Riepilogo ordine</h2>
            <div className="space-y-2.5">
              {data.order.items.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full text-xs font-bold flex items-center justify-center">
                      {item.quantity}
                    </span>
                    <span className="text-sm text-slate-700">{item.menuItem.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 mt-4 pt-3 flex justify-between">
              <span className="font-bold text-slate-800">Totale pagato</span>
              <span className="font-black text-emerald-600 text-lg">{formatCurrency(data.order.total)}</span>
            </div>
          </div>

          {data.order.table && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <span className="text-lg font-black text-orange-600">{data.order.table.number}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Tavolo {data.order.table.number}</p>
                <p className="text-xs text-slate-400">Il cameriere ti porterà i piatti al tavolo</p>
              </div>
            </div>
          )}

          {data.customerEmail && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-700">
              Ricevuta inviata a <strong>{data.customerEmail}</strong>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">Il tuo ordine è in cucina!</p>
            <p>Conserva questa pagina come prova di pagamento. In caso di problemi, mostrala al cameriere.</p>
          </div>
        </div>
      )}

      <div className="px-5 pb-8">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 w-full py-3.5 border-2 border-slate-200 rounded-2xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alla home
        </Link>
      </div>
    </div>
  )
}
