import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, cn, toLocalDateInput } from '../lib/utils'
import { generateFiscalPdf, type FiscalReportData } from '../lib/fiscalPdf'
import { buildFiscalPdfLabels } from '../lib/fiscalLabels'
import { downloadCSV } from '../lib/export'
import { getFiscalIntlLocale } from '../i18n'
import { useAuth, useFiscalRegime, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import AccessDenied from '../components/AccessDenied'
import { useRole } from '../hooks/useRole'
import { tRegime, type FiscalRegime, type TaxRegion } from '../lib/fiscalRegime'
import {
  FileDown, CalendarRange, Loader2, Receipt, Coins, Wallet,
  Sparkles, AlertCircle, Hash,
} from 'lucide-react'
import toast from 'react-hot-toast'

type FilterMode = 'day' | 'month' | 'range'

interface FiscalApiResponse extends FiscalReportData {
  period: { mode: string; start: string; end: string }
  fiscalRegime?: FiscalRegime
  reportLabels?: {
    netRevenueSub: string
    tipsLabel: string
    tipsSub: string
    tipsSectionTitle?: string
    taxColumnName: string
    complianceNotice: string
    legalDisclaimer: string
  }
  summary: FiscalReportData['summary'] & {
    electronicTipsTotal?: number
    tipTaxStatus?: string
    tipsDistribution?: {
      totalTracked: number
      exemptFromTax: string
      legalBasis: string
      trackedMethods?: string[]
    }
  }
}

const glassPanel = 'premium-card'

const inputClass = cn(
  'glass-input rounded-xl px-3 py-2.5 text-sm text-fumo',
  'focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-amber-700/40',
  'transition-all duration-200',
)

export default function ReportFiscal() {
  const { canAccessAdminNav } = useRole()
  if (!canAccessAdminNav()) return <AccessDenied />
  return <ReportFiscalContent />
}

function ReportFiscalContent() {
  const { t, i18n } = useTranslation()
  const { restaurant } = useAuth()
  const fiscalRegime = useFiscalRegime()
  const tenantQueryKey = useTenantQueryKey()
  const now = new Date()
  const [mode, setMode] = useState<FilterMode>('month')
  const [dayDate, setDayDate] = useState(() => toLocalDateInput())
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rangeFrom, setRangeFrom] = useState(() => toLocalDateInput())
  const [rangeTo, setRangeTo] = useState(() => toLocalDateInput())
  const [isExporting, setIsExporting] = useState(false)

  const { data, isLoading, isFetching, isError } = useQuery<FiscalApiResponse>({
    queryKey: tq(tenantQueryKey, 'reports', 'fiscal', mode, dayDate, year, month, rangeFrom, rangeTo),
    queryFn: () => api.get(`/reports/fiscal?${queryParams(mode, dayDate, year, month, rangeFrom, rangeTo)}`).then(r => r.data),
    enabled: !!restaurant?.id,
  })

  /** Regime fiscale dal tenant DB; se l'API risponde, usa fiscalRegime della risposta (più aggiornato). */
  const activeRegime = data?.fiscalRegime ?? fiscalRegime
  const taxRegion: TaxRegion = activeRegime.taxRegion
  const taxName = activeRegime.taxName
  const taxRate = activeRegime.taxRate
  const countryCode = activeRegime.countryCode
  const fiscalLocale = getFiscalIntlLocale(activeRegime.defaultLocale)

  const months = useMemo(
    () => t('reportFiscal.months', { returnObjects: true }) as string[],
    [t, i18n.language],
  )

  const filterOptions = useMemo(
    (): { key: FilterMode; label: string }[] => [
      { key: 'day', label: t('reportFiscal.filterDay') },
      { key: 'month', label: t('reportFiscal.filterMonth') },
      { key: 'range', label: t('reportFiscal.filterRange') },
    ],
    [t, i18n.language],
  )

  const summaryCards = useMemo(
    () => [
      {
        key: 'facturado',
        label: tRegime(t, taxRegion, 'cards.netRevenue.label'),
        sub: data?.reportLabels?.netRevenueSub ?? tRegime(t, taxRegion, 'cards.netRevenue.sub'),
        icon: Receipt,
        gradient: 'from-blue-500/20 to-indigo-500/10',
        iconColor: 'text-blue-400',
        ring: 'ring-blue-500/20',
      },
      {
        key: 'propinas',
        label: data?.reportLabels?.tipsLabel ?? tRegime(t, taxRegion, 'cards.tips.label'),
        sub: data?.reportLabels?.tipsSub ?? tRegime(t, taxRegion, 'cards.tips.sub'),
        icon: Coins,
        gradient: 'from-amber-500/20 to-orange-500/10',
        iconColor: 'text-aura-gold',
        ring: 'ring-amber-500/20',
      },
      {
        key: 'conciliacion',
        label: tRegime(t, taxRegion, 'cards.reconciliation.label'),
        sub: tRegime(t, taxRegion, 'cards.reconciliation.sub'),
        icon: Wallet,
        gradient: 'from-emerald-500/20 to-teal-500/10',
        iconColor: 'text-emerald-400',
        ring: 'ring-emerald-500/20',
      },
    ],
    [t, taxRegion, countryCode, tenantQueryKey, data?.reportLabels],
  )

  const tableHeaders = useMemo(
    () => [
      tRegime(t, taxRegion, 'table.date'),
      tRegime(t, taxRegion, 'table.orderId'),
      tRegime(t, taxRegion, 'table.taxableBase'),
      tRegime(t, taxRegion, 'table.tax'),
      tRegime(t, taxRegion, 'table.restaurantTotal'),
      tRegime(t, taxRegion, 'table.tip'),
      tRegime(t, taxRegion, 'table.collectedTotal'),
    ],
    [t, taxRegion, countryCode, tenantQueryKey],
  )

  const fmtDate = (d: string | Date) =>
    new Intl.DateTimeFormat(fiscalLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))

  const hasExportData = Boolean(data && !isLoading && data.rows.length > 0)

  const summaryValues = data
    ? [
        data.summary.totalFacturadoNeto,
        taxRegion === 'IT_MAIN'
          ? (data.summary.electronicTipsTotal ?? 0)
          : data.summary.totalPropinas,
        data.summary.totalConciliacion,
      ]
    : [0, 0, 0]

  const handleExportCSV = () => {
    if (!data?.rows?.length) {
      toast.error(t('reportFiscal.noData'))
      return
    }
    const labels = buildFiscalPdfLabels(t, taxRegion, activeRegime.defaultLocale, taxRate)
    const headers = [...labels.headers]
    downloadCSV(
      `${labels.filenamePrefix}-${data.period.start.slice(0, 10)}.csv`,
      headers,
      data.rows.map(r => {
        const base = [
          r.fecha ? fmtDate(r.fecha) : '—',
          r.orderId.slice(-6).toUpperCase(),
          r.baseImponible,
          r.tax,
          r.revenueAmount,
          r.tipAmount,
          r.total,
        ]
        if (taxRegion === 'IT_MAIN') {
          base.push((r as { paymentMethod?: string }).paymentMethod ?? '')
        }
        return base
      }),
    )
    toast.success(t('reportFiscal.csvGenerated'))
  }

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
      generateFiscalPdf(
        {
          ...data,
          rows: data.rows.map(r => ({
            ...r,
            fecha: r.fecha ? (typeof r.fecha === 'string' ? r.fecha : new Date(r.fecha).toISOString()) : null,
          })),
        },
        buildFiscalPdfLabels(t, taxRegion, activeRegime.defaultLocale, taxRate),
      )
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

  const modeIndex = filterOptions.findIndex(o => o.key === mode)

  const periodMeta = data
    ? fmtDate(data.period.start) +
      (data.period.start !== data.period.end ? ` — ${fmtDate(data.period.end)}` : '')
    : ''

  const regimeLabel = useMemo(
    () => tRegime(t, taxRegion, 'regimeLabel'),
    [t, taxRegion, tenantQueryKey],
  )

  return (
    <div key={tenantQueryKey} className="relative min-h-full -m-6 p-6">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="absolute top-1/2 -left-24 h-80 w-80 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-400/80">
              <Sparkles className="h-4 w-4" />
              {tRegime(t, taxRegion, 'breadcrumb', { regime: regimeLabel })}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 bg-clip-text text-transparent">
                {tRegime(t, taxRegion, 'title')}
              </span>
            </h1>
            <p className="max-w-xl text-sm text-fumo/90">
              {tRegime(t, taxRegion, 'subtitle', { taxName })}
            </p>
            <p className="max-w-xl text-xs text-fumo">
              {tRegime(t, taxRegion, 'tipExemptNote')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isLoading || !hasExportData}
              className="flex items-center gap-2 rounded-2xl premium-card px-5 py-3 text-sm font-semibold text-fumo hover:bg-white/[0.05] disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {t('reportFiscal.exportCsv', { defaultValue: 'Esporta CSV' })}
            </button>
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
                  <span>{t('reportFiscal.exporting')}</span>
                </>
              ) : (
                <>
                  <FileDown className="h-5 w-5" />
                  <span>{t('reportFiscal.exportPdf')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-aura-gold/25 bg-aura-gold/10 px-4 py-3 text-xs text-amber-900">
          {data?.reportLabels?.legalDisclaimer ?? t('reportFiscal.legalDisclaimer')}
        </div>

        {data?.summary.tipsDistribution && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">
              {data.reportLabels?.tipsSectionTitle ?? data.reportLabels?.tipsLabel}
            </p>
            <p className="mt-1">
              {formatCurrency(data.summary.tipsDistribution.totalTracked)} ·{' '}
              {data.summary.tipsDistribution.legalBasis}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {summaryCards.map((card, i) => {
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-fumo">
                      {card.label}
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-pietra">
                      {isLoading ? '—' : formatCurrency(summaryValues[i])}
                    </p>
                    <p className="mt-1 text-xs text-fumo">{card.sub}</p>
                    {card.key === 'propinas' && taxRegion === 'IT_MAIN' && data && data.summary.totalPropinas !== (data.summary.electronicTipsTotal ?? 0) && (
                      <p className="mt-1 text-[10px] text-fumo">
                        {t('reportFiscal.totalTipsNote', {
                          total: formatCurrency(data.summary.totalPropinas),
                        })}
                      </p>
                    )}
                  </div>
                  <div className={cn('rounded-xl premium-card p-3 shadow-sm', card.iconColor)}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className={cn(glassPanel, 'p-6 space-y-5')}>
          <div className="flex items-center gap-2 text-sm font-semibold text-fumo">
            <CalendarRange className="h-4 w-4 text-amber-400" />
            {t('reportFiscal.filterPeriod')}
          </div>

          <div className="relative w-full sm:w-auto inline-flex rounded-full glass-chip p-1">
            <div
              className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 shadow-md shadow-orange-500/25 transition-all duration-300 ease-out"
              style={{
                left: 0,
                width: `calc(100% / ${filterOptions.length})`,
                transform: `translateX(${modeIndex * 100}%)`,
              }}
            />
            {filterOptions.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMode(opt.key)}
                className={cn(
                  'relative z-10 flex-1 min-w-0 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors duration-300',
                  mode === opt.key ? 'text-white' : 'text-fumo hover:text-pietra',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            {mode === 'day' && (
              <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} className={inputClass} />
            )}

            {mode === 'month' && (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full">
                <select value={month} onChange={e => setMonth(+e.target.value)} className={inputClass}>
                  {months.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select value={year} onChange={e => setYear(+e.target.value)} className={inputClass}>
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {mode === 'range' && (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full">
                <label className="flex items-center gap-2 text-sm text-fumo w-full sm:w-auto">
                  {t('reportFiscal.from')}
                  <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className={inputClass} />
                </label>
                <label className="flex items-center gap-2 text-sm text-fumo w-full sm:w-auto">
                  {t('reportFiscal.to')}
                  <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className={inputClass} />
                </label>
              </div>
            )}
          </div>

          {data && (
            <p className="text-xs text-fumo">
              {t('reportFiscal.transactionsMeta', { count: data.summary.transactionCount, period: periodMeta })}
              {data.restaurant.taxId && tRegime(t, taxRegion, 'taxIdMeta', { taxId: data.restaurant.taxId })}
            </p>
          )}
        </div>

        <div className={cn(glassPanel, 'overflow-hidden p-4 sm:p-6')}>
          {(isLoading || isFetching) && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-fumo">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
              <p className="text-sm font-medium">{t('reportFiscal.loading')}</p>
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-16 text-red-500">
              <AlertCircle className="h-10 w-10 opacity-60" />
              <p className="text-sm">{t('reportFiscal.loadError')}</p>
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              {data.rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-fumo">
                  <AlertCircle className="h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium">{t('reportFiscal.emptyTitle')}</p>
                  <p className="text-xs">{t('reportFiscal.emptyHint')}</p>
                </div>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full max-w-full border-separate border-spacing-y-3 text-sm">
                    <thead>
                      <tr>
                        {tableHeaders.map(h => (
                          <th
                            key={h}
                            className="px-4 pb-1 text-left text-[10px] font-bold uppercase tracking-widest text-fumo"
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
                                'premium-card px-4 py-3.5 shadow-sm transition-all duration-200',
                                'group-hover:border-orange-200 group-hover:bg-white/[0.05] group-hover:shadow-md group-hover:shadow-orange-100/40',
                              )}
                            >
                              <span className="whitespace-nowrap text-fumo">
                                {row.fecha ? fmtDate(row.fecha) : '—'}
                              </span>
                              <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fumo">
                                <Hash className="h-3 w-3 text-orange-400" />
                                {row.orderId.slice(-6).toUpperCase()}
                              </span>
                              <span className="text-fumo">{formatCurrency(row.baseImponible)}</span>
                              <span className="text-fumo">{formatCurrency(row.tax)}</span>
                              <span className="font-semibold text-pietra">{formatCurrency(row.revenueAmount)}</span>
                              <span className="font-medium text-aura-gold">{formatCurrency(row.tipAmount)}</span>
                              <span className="font-bold text-aura-gold">{formatCurrency(row.total)}</span>
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

function queryParams(
  mode: FilterMode,
  dayDate: string,
  year: number,
  month: number,
  rangeFrom: string,
  rangeTo: string,
) {
  if (mode === 'day') return `mode=day&date=${dayDate}`
  if (mode === 'month') return `year=${year}&month=${month}`
  return `mode=range&from=${rangeFrom}&to=${rangeTo}`
}
