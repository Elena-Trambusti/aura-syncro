import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, cn, toLocalDateInput } from '../lib/utils'
import { generateFiscalPdf, type FiscalReportData } from '../lib/fiscalPdf'
import {
  FileDown, CalendarRange, Loader2, Receipt, Coins, Wallet,
  Sparkles, AlertCircle, Hash,
} from 'lucide-react'
import toast from 'react-hot-toast'

type FilterMode = 'day' | 'month' | 'range'

interface FiscalApiResponse extends FiscalReportData {
  period: { mode: string; start: string; end: string }
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: 'day', label: 'Por Día' },
  { key: 'month', label: 'Por Mes' },
  { key: 'range', label: 'Rango' },
]

const SUMMARY_CARDS = [
  {
    key: 'facturado',
    label: 'Total Facturado Neto',
    sub: 'Sujeto a impuestos (IGIC)',
    icon: Receipt,
    gradient: 'from-blue-500/20 to-indigo-500/10',
    iconColor: 'text-blue-600',
    ring: 'ring-blue-500/20',
  },
  {
    key: 'propinas',
    label: 'Total Propinas Personal',
    sub: 'Exento de IGIC · Canarias',
    icon: Coins,
    gradient: 'from-amber-500/20 to-orange-500/10',
    iconColor: 'text-amber-600',
    ring: 'ring-amber-500/20',
  },
  {
    key: 'conciliacion',
    label: 'Conciliación Bancaria POS',
    sub: 'Total cobrado en TPV',
    icon: Wallet,
    gradient: 'from-emerald-500/20 to-teal-500/10',
    iconColor: 'text-emerald-600',
    ring: 'ring-emerald-500/20',
  },
] as const

const glassPanel = 'glass-card'

const inputClass = cn(
  'glass-input rounded-xl px-3 py-2.5 text-sm text-stone-200',
  'focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-amber-700/40',
  'transition-all duration-200',
)

export default function ReportFiscal() {
  const { t } = useTranslation()
  const now = new Date()
  const [mode, setMode] = useState<FilterMode>('month')
  const [dayDate, setDayDate] = useState(() => toLocalDateInput())
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rangeFrom, setRangeFrom] = useState(() => toLocalDateInput())
  const [rangeTo, setRangeTo] = useState(() => toLocalDateInput())
  const [isExporting, setIsExporting] = useState(false)

  const queryParams = () => {
    if (mode === 'day') return `mode=day&date=${dayDate}`
    if (mode === 'month') return `year=${year}&month=${month}`
    return `mode=range&from=${rangeFrom}&to=${rangeTo}`
  }

  const { data, isLoading, isFetching, isError } = useQuery<FiscalApiResponse>({
    queryKey: ['reports', 'fiscal', mode, dayDate, year, month, rangeFrom, rangeTo],
    queryFn: () => api.get(`/reports/fiscal?${queryParams()}`).then(r => r.data),
  })

  const fmtDate = (d: string | Date) =>
    new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))

  const hasExportData = Boolean(data && !isLoading && data.rows.length > 0)

  const summaryValues = data
    ? [data.summary.totalFacturadoNeto, data.summary.totalPropinas, data.summary.totalConciliacion]
    : [0, 0, 0]

  const handleExportPDF = async () => {
    if (!data?.rows?.length) {
      toast.error(t('reportFiscal.noData'), {
        icon: '⚠️',
        style: { borderRadius: '12px', background: '#1e293b', color: '#fff' },
      })
      return
    }

    setIsExporting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 350))
    generateFiscalPdf({
      ...data,
      rows: data.rows.map(r => ({
        ...r,
        fecha: r.fecha ? (typeof r.fecha === 'string' ? r.fecha : new Date(r.fecha).toISOString()) : null,
      })),
    })
      toast.success(t('reportFiscal.pdfGenerated'), {
        icon: '📄',
        style: { borderRadius: '12px' },
      })
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error(t('reportFiscal.pdfError'), {
        icon: '❌',
        style: { borderRadius: '12px' },
      })
    } finally {
      setIsExporting(false)
    }
  }

  const modeIndex = FILTER_OPTIONS.findIndex(o => o.key === mode)

  return (
    <div className="relative min-h-full -m-6 p-6">
      {/* Background mesh */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="absolute top-1/2 -left-24 h-80 w-80 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-400/80">
              <Sparkles className="h-4 w-4" />
              Report → Fiscal · Normativa Canarias
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 bg-clip-text text-transparent">
                Libro de Registro Fiscal
              </span>
            </h1>
            <p className="max-w-xl text-sm text-stone-400/90">
              Exportación legal de propinas y facturación · Split IGIC / Propina voluntaria
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting || isLoading || !hasExportData}
            className={cn(
              'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-6 py-4',
              'bg-gradient-to-r from-orange-500 to-amber-500 font-semibold text-white',
              'shadow-lg shadow-orange-500/30 transition-all duration-300',
              'hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/40',
              'hover:ring-4 hover:ring-orange-500/30',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:ring-0',
              !isExporting && hasExportData ? 'animate-[pulse_3s_ease-in-out_infinite]' : '',
            )}
          >
            <span className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
            {isExporting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generando documento...</span>
              </>
            ) : (
              <>
                <FileDown className="h-5 w-5" />
                <span>Exportar PDF para Inspección</span>
              </>
            )}
          </button>
        </div>

        {/* Summary widgets */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {SUMMARY_CARDS.map((card, i) => {
            const Icon = card.icon
            return (
              <div
                key={card.key}
                className={cn(
                  glassPanel,
                  'group relative overflow-hidden p-6 transition-all duration-300',
                  'hover:-translate-y-1 hover:shadow-orange-200/30',
                  `ring-1 ${card.ring}`,
                )}
              >
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', card.gradient)} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                      {card.label}
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-stone-100">
                      {isLoading ? '—' : formatCurrency(summaryValues[i])}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">{card.sub}</p>
                  </div>
                  <div className={cn('rounded-xl glass-card p-3 shadow-sm', card.iconColor)}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className={cn(glassPanel, 'p-6 space-y-5')}>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-200">
            <CalendarRange className="h-4 w-4 text-amber-400" />
            Filtro de periodo
          </div>

          {/* iOS-style pill switch */}
          <div className="relative inline-flex rounded-full glass-chip p-1">
            <div
              className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 shadow-md shadow-orange-500/25 transition-all duration-300 ease-out"
              style={{
                width: `calc(${100 / FILTER_OPTIONS.length}% - 4px)`,
                left: `calc(${modeIndex * (100 / FILTER_OPTIONS.length)}% + 2px)`,
              }}
            />
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMode(opt.key)}
                className={cn(
                  'relative z-10 min-w-[7rem] rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-300',
                  mode === opt.key ? 'text-white' : 'text-stone-300 hover:text-stone-100',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {mode === 'day' && (
              <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} className={inputClass} />
            )}
            {mode === 'month' && (
              <>
                <select value={month} onChange={e => setMonth(+e.target.value)} className={inputClass}>
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select value={year} onChange={e => setYear(+e.target.value)} className={inputClass}>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            )}
            {mode === 'range' && (
              <>
                <label className="flex items-center gap-2 text-sm text-stone-400">
                  Desde
                  <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className={inputClass} />
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-400">
                  Hasta
                  <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className={inputClass} />
                </label>
              </>
            )}
          </div>

          {data && (
            <p className="text-xs text-stone-500">
              {data.summary.transactionCount} transacciones · {fmtDate(data.period.start)}
              {data.period.start !== data.period.end && ` — ${fmtDate(data.period.end)}`}
              {data.restaurant.taxId && ` · NIF/CIF: ${data.restaurant.taxId}`}
            </p>
          )}
        </div>

        {/* Table */}
        <div className={cn(glassPanel, 'overflow-hidden p-4 sm:p-6')}>
          {(isLoading || isFetching) && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-500">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
              <p className="text-sm font-medium">Cargando datos fiscales...</p>
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-16 text-red-500">
              <AlertCircle className="h-10 w-10 opacity-60" />
              <p className="text-sm">Error al cargar los datos fiscales</p>
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              {data.rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-stone-500">
                  <AlertCircle className="h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">No hay transacciones pagadas en este periodo</p>
                  <p className="text-xs">Seleccione otro rango de fechas o registre pagos con propina</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] border-separate border-spacing-y-3 text-sm">
                    <thead>
                      <tr>
                        {['Fecha', 'ID Comanda', 'Base Imponible', 'IGIC', 'Total Restaurante', 'Propina', 'Total Cobrado'].map(h => (
                          <th
                            key={h}
                            className="px-4 pb-1 text-left text-[10px] font-bold uppercase tracking-widest text-stone-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map(row => (
                        <tr
                          key={row.orderId}
                          className={cn(
                            'group transition-all duration-200',
                            'hover:-translate-y-1',
                          )}
                        >
                          <td colSpan={7} className="p-0">
                            <div
                              className={cn(
                                'grid grid-cols-7 items-center rounded-xl border border-gray-200/40',
                                'glass-card px-4 py-3.5 shadow-sm transition-all duration-200',
                                'group-hover:border-orange-200/60 group-hover:bg-white/[0.08] group-hover:shadow-lg group-hover:shadow-orange-100/30',
                              )}
                            >
                              <span className="whitespace-nowrap text-stone-300">
                                {row.fecha ? fmtDate(row.fecha) : '—'}
                              </span>
                              <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-stone-200">
                                <Hash className="h-3 w-3 text-orange-400" />
                                {row.orderId.slice(-6).toUpperCase()}
                              </span>
                              <span className="text-stone-300">{formatCurrency(row.baseImponible)}</span>
                              <span className="text-stone-400">{formatCurrency(row.igic)}</span>
                              <span className="font-semibold text-stone-100">{formatCurrency(row.revenueAmount)}</span>
                              <span className="font-medium text-amber-600">{formatCurrency(row.tipAmount)}</span>
                              <span className="font-bold text-amber-400">{formatCurrency(row.total)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
