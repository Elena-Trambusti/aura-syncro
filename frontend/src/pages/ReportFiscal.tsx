import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { formatCurrency, cn, toDateInputInTimezone } from '../lib/utils'
import { generateFiscalPdf, type FiscalReportData } from '../lib/fiscalPdf'
import { buildFiscalPdfLabels } from '../lib/fiscalLabels'
import { downloadCSV } from '../lib/export'
import { getFiscalIntlLocale } from '../i18n'
import { useAuth, useFiscalRegime, useTenantQueryKey } from '../contexts/AuthContext'
import { tq } from '../lib/queryKeys'
import AccessDenied from '../components/AccessDenied'
import { useRole } from '../hooks/useRole'
import { tRegime, type FiscalRegime, type TaxRegion } from '../lib/fiscalRegime'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import FilterPills from '../components/ui/FilterPills'
import KpiCard from '../components/ui/KpiCard'
import PageSkeleton from '../components/ui/PageSkeleton'
import { LuxuryChartFrame } from '../components/charts'
import { LuxuryAreaChart, LuxuryBarChart, LuxuryLineChart } from '../components/charts/lazy'
import ChartSuspense from '../components/charts/ChartSuspense'
import {
  FileDown, CalendarRange, Loader2, Receipt, Coins, Wallet,
  AlertCircle, Hash, ShieldCheck, ShieldAlert,
} from 'lucide-react'
import { toast } from '@/lib/toast'

type FilterMode = 'day' | 'month' | 'range'

const MAX_FISCAL_RANGE_DAYS = 366
const FISCAL_ROW_PAGE_SIZE = 50

function countRangeDays(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`).getTime()
  const end = new Date(`${to}T12:00:00`).getTime()
  if (end < start) return 0
  return Math.floor((end - start) / 86_400_000) + 1
}

interface FiscalApiResponse extends FiscalReportData {
  period: { mode: string; start: string; end: string }
  fiscalRegime?: FiscalRegime
  compliance?: {
    integrityChainValid: boolean
    brokenAtOrderId?: string | null
    verifactuEnabled?: boolean
  }
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

interface DailyFiscalPoint {
  date: string
  revenue: number
  tax: number
  tips: number
  total: number
}

const inputClass = cn(
  'glass-input rounded-xl px-3 py-2.5 text-sm text-fumo',
  'focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-aura-gold/30',
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
  const tenantTz = restaurant?.timezone ?? 'Europe/Rome'
  const now = new Date()
  const [mode, setMode] = useState<FilterMode>('month')
  const [dayDate, setDayDate] = useState(() => toDateInputInTimezone(tenantTz))
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rangeFrom, setRangeFrom] = useState(() => toDateInputInTimezone(tenantTz))
  const [rangeTo, setRangeTo] = useState(() => toDateInputInTimezone(tenantTz))
  const [isExporting, setIsExporting] = useState(false)
  const [rowPage, setRowPage] = useState(1)

  const rangeTooLarge = mode === 'range' && countRangeDays(rangeFrom, rangeTo) > MAX_FISCAL_RANGE_DAYS

  useEffect(() => {
    setRowPage(1)
  }, [mode, dayDate, year, month, rangeFrom, rangeTo])

  const { data, isLoading, isFetching, isError } = useQuery<FiscalApiResponse>({
    queryKey: tq(tenantQueryKey, 'reports', 'fiscal', mode, dayDate, year, month, rangeFrom, rangeTo),
    queryFn: () => api.get(`/reports/fiscal?${queryParams(mode, dayDate, year, month, rangeFrom, rangeTo)}`).then(r => r.data),
    enabled: !!restaurant?.id && !rangeTooLarge,
  })

  const totalRowPages = Math.max(1, Math.ceil((data?.rows.length ?? 0) / FISCAL_ROW_PAGE_SIZE))
  const pagedRows = useMemo(() => {
    if (!data?.rows?.length) return []
    const start = (rowPage - 1) * FISCAL_ROW_PAGE_SIZE
    return data.rows.slice(start, start + FISCAL_ROW_PAGE_SIZE)
  }, [data?.rows, rowPage])

  const { data: vatBreakdown } = useQuery<{
    breakdown: Array<{ taxRate: number; taxableBase: number; tax: number; count: number }>
    totals: { taxableBase: number; tax: number; orders: number }
  }>({
    queryKey: tq(tenantQueryKey, 'reports', 'fiscal-vat', mode, dayDate, year, month, rangeFrom, rangeTo),
    queryFn: () => api.get(`/reports/fiscal/vat-breakdown?${queryParams(mode, dayDate, year, month, rangeFrom, rangeTo)}`).then(r => r.data),
    enabled: !!restaurant?.id && !rangeTooLarge,
  })

  const activeRegime = data?.fiscalRegime ?? fiscalRegime
  const taxRegion: TaxRegion = activeRegime.taxRegion
  const taxRate = activeRegime.taxRate
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

  const tableHeaders = useMemo(() => {
    const headers = [
      tRegime(t, taxRegion, 'table.date'),
      tRegime(t, taxRegion, 'table.orderId'),
      tRegime(t, taxRegion, 'table.taxableBase'),
      tRegime(t, taxRegion, 'table.tax'),
      tRegime(t, taxRegion, 'table.restaurantTotal'),
      tRegime(t, taxRegion, 'table.tip'),
      tRegime(t, taxRegion, 'table.collectedTotal'),
    ]
    if (taxRegion === 'IT_MAIN') headers.push(t('reportFiscal.tablePaymentMethod'))
    if (taxRegion !== 'IT_MAIN') headers.push(t('reportFiscal.tableIntegrityHash'))
    return headers
  }, [t, taxRegion, tenantQueryKey])

  const fmtDate = (d: string | Date) =>
    new Intl.DateTimeFormat(fiscalLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: tenantTz,
    }).format(new Date(d))

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

  const dailyTrend = useMemo((): DailyFiscalPoint[] => {
    if (!data?.rows?.length) return []
    const map = new Map<string, DailyFiscalPoint>()
    for (const row of data.rows) {
      const key = row.fecha
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: tenantTz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(row.fecha))
        : 'unknown'
      const cur = map.get(key) ?? { date: key, revenue: 0, tax: 0, tips: 0, total: 0 }
      cur.revenue += row.revenueAmount
      cur.tax += row.tax
      cur.tips += row.tipAmount
      cur.total += row.total
      map.set(key, cur)
    }
    return [...map.values()]
      .filter(p => p.date !== 'unknown')
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [data?.rows, tenantTz])

  const vatChartData = useMemo(
    () => (vatBreakdown?.breakdown ?? []).map(row => ({
      label: `${row.taxRate}%`,
      tax: row.tax,
      taxableBase: row.taxableBase,
      count: row.count,
    })),
    [vatBreakdown?.breakdown],
  )

  const regimeLabel = useMemo(
    () => tRegime(t, taxRegion, 'regimeLabel'),
    [t, taxRegion, tenantQueryKey],
  )

  const periodMeta = data
    ? fmtDate(data.period.start) +
      (data.period.start !== data.period.end ? ` — ${fmtDate(data.period.end)}` : '')
    : ''

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
      toast.error(t('reportFiscal.noData'))
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
        { timeZone: tenantTz },
      )
      toast.success(t('reportFiscal.pdfGenerated'))
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error(t('reportFiscal.pdfError'))
    } finally {
      setIsExporting(false)
    }
  }

  const revenueSparkline = dailyTrend.map(d => d.revenue)

  return (
    <ExecutivePageShell key={tenantQueryKey} className="space-y-6">
      <ExecutivePageHeader
        eyebrow={tRegime(t, taxRegion, 'breadcrumb', { regime: regimeLabel })}
        title={tRegime(t, taxRegion, 'title')}
        subtitle={(
          <>
            <p>{tRegime(t, taxRegion, 'subtitle', { taxName: activeRegime.taxName })}</p>
            <p className="mt-1 text-xs text-fumo/80">{tRegime(t, taxRegion, 'tipExemptNote')}</p>
          </>
        )}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isLoading || !hasExportData}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-fumo transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              <FileDown className="h-4 w-4 text-aura-gold" />
              {t('reportFiscal.exportCsv', { defaultValue: 'Esporta CSV' })}
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting || isLoading || !hasExportData}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-[#0B0E14]',
                'bg-gradient-to-r from-[#D4AF37] via-[#C9A227] to-[#E8C547]',
                'shadow-lg shadow-amber-900/25 transition-all duration-300',
                'hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('reportFiscal.exporting')}
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  {t('reportFiscal.exportPdf')}
                </>
              )}
            </button>
          </div>
        )}
      />

      <div className="rounded-xl border border-aura-gold/15 bg-aura-gold/[0.04] px-4 py-3 text-xs leading-relaxed text-fumo">
        {data?.reportLabels?.legalDisclaimer ?? tRegime(t, taxRegion, 'pdf.legalDisclaimer')}
      </div>

      {data?.compliance && (
        <div className={cn(
          'flex items-start gap-3 rounded-xl border px-4 py-3 text-xs',
          data.compliance.integrityChainValid
            ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'
            : 'border-rose-500/25 bg-rose-500/[0.08] text-rose-200',
        )}>
          {data.compliance.integrityChainValid
            ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
          <div>
            <p>
              {data.compliance.integrityChainValid
                ? t('reportFiscal.complianceChainValid')
                : t('reportFiscal.complianceChainInvalid', {
                    orderId: data.compliance.brokenAtOrderId?.slice(-6).toUpperCase() ?? '—',
                  })}
            </p>
            {data.compliance.verifactuEnabled && (
              <p className="mt-1 text-fumo/80">{t('reportFiscal.complianceVerifactu')}</p>
            )}
          </div>
        </div>
      )}

      {isLoading && !data ? (
        <PageSkeleton variant="kpi" count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            title={tRegime(t, taxRegion, 'cards.netRevenue.label')}
            value={formatCurrency(summaryValues[0])}
            subtitle={data?.reportLabels?.netRevenueSub ?? tRegime(t, taxRegion, 'cards.netRevenue.sub')}
            icon={Receipt}
            accent="gold"
            size="hero"
            valueTone="gold"
            sparklineData={revenueSparkline.length >= 2 ? revenueSparkline : undefined}
          />
          <KpiCard
            title={data?.reportLabels?.tipsLabel ?? tRegime(t, taxRegion, 'cards.tips.label')}
            value={formatCurrency(summaryValues[1])}
            subtitle={data?.reportLabels?.tipsSub ?? tRegime(t, taxRegion, 'cards.tips.sub')}
            icon={Coins}
            accent="amber"
            size="hero"
          />
          <KpiCard
            title={tRegime(t, taxRegion, 'cards.reconciliation.label')}
            value={formatCurrency(summaryValues[2])}
            subtitle={tRegime(t, taxRegion, 'cards.reconciliation.sub')}
            icon={Wallet}
            accent="emerald"
            size="hero"
          />
        </div>
      )}

      {taxRegion === 'IT_MAIN' && data && data.summary.totalPropinas !== (data.summary.electronicTipsTotal ?? 0) && (
        <p className="text-xs text-fumo/80 px-1">
          {t('reportFiscal.totalTipsNote', { total: formatCurrency(data.summary.totalPropinas) })}
        </p>
      )}

      {!isLoading && dailyTrend.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LuxuryChartFrame
            hero
            eyebrow={tRegime(t, taxRegion, 'regimeLabel')}
            title={t('reportFiscal.chartRevenueTitle')}
            subtitle={t('reportFiscal.chartRevenueSubtitle')}
          >
            <ChartSuspense height={260}>
              <LuxuryAreaChart
                data={dailyTrend}
                dataKey="revenue"
                xKey="date"
                locale={fiscalLocale}
                valueLabel={t('reportFiscal.chartRevenueLabel')}
                height={260}
              />
            </ChartSuspense>
          </LuxuryChartFrame>

          <LuxuryChartFrame
            title={t('reportFiscal.chartCompositionTitle')}
            subtitle={t('reportFiscal.chartCompositionSubtitle')}
          >
            <ChartSuspense height={260}>
              <LuxuryLineChart
                data={dailyTrend}
                xKey="date"
                locale={fiscalLocale}
                height={260}
                series={[
                  { dataKey: 'tax', label: activeRegime.taxName, accent: 'champagne', dashed: true, dot: false },
                  { dataKey: 'tips', label: t('reportFiscal.chartTipsLabel'), accent: 'gold' },
                ]}
                labelFormatter={v => fmtDate(v)}
                valueFormatter={(v, key) =>
                  key === 'tips' || key === 'tax' ? formatCurrency(v) : String(v)
                }
              />
            </ChartSuspense>
          </LuxuryChartFrame>
        </div>
      )}

      {vatChartData.length > 0 && (
        <LuxuryChartFrame
          title={t('reportFiscal.chartVatTitle')}
          subtitle={t('reportFiscal.chartVatSubtitle')}
        >
          <ChartSuspense height={220}>
            <LuxuryBarChart
              data={vatChartData}
              dataKey="tax"
              xKey="label"
              locale={fiscalLocale}
              height={220}
              valueLabel={activeRegime.taxName}
              labelFormatter={label => t('reportFiscal.vatBreakdownRate', { rate: label.replace('%', '') })}
            />
          </ChartSuspense>
        </LuxuryChartFrame>
      )}

      {vatBreakdown && vatBreakdown.breakdown.length > 0 && (
        <div className="aura-module-frame p-4 sm:p-5">
          <h3 className="premium-section-title text-sm">{t('reportFiscal.vatBreakdownTitle')}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vatBreakdown.breakdown.map(row => (
              <div
                key={row.taxRate}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs"
              >
                <p className="font-semibold text-pietra">
                  {t('reportFiscal.vatBreakdownRate', { rate: row.taxRate })}
                </p>
                <p className="mt-2 text-fumo">
                  {t('reportFiscal.vatBreakdownTaxable')}: {formatCurrency(row.taxableBase)}
                </p>
                <p className="text-fumo">
                  {activeRegime.taxName}: {formatCurrency(row.tax)}
                </p>
                <p className="text-fumo/70">
                  {t('reportFiscal.vatBreakdownOrders')}: {row.count}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.summary.tipsDistribution && (
        <div className="aura-module-frame px-4 py-3 text-xs text-fumo">
          <p className="font-semibold text-pietra">
            {data.reportLabels?.tipsSectionTitle ?? data.reportLabels?.tipsLabel}
          </p>
          <p className="mt-1">
            {formatCurrency(data.summary.tipsDistribution.totalTracked)} ·{' '}
            {data.summary.tipsDistribution.legalBasis}
          </p>
        </div>
      )}

      <section className="aura-module-frame space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-fumo">
          <CalendarRange className="h-4 w-4 text-aura-gold" />
          {t('reportFiscal.filterPeriod')}
        </div>

        <FilterPills
          filters={filterOptions}
          active={mode}
          onChange={key => setMode(key as FilterMode)}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {mode === 'day' && (
            <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} className={inputClass} />
          )}

          {mode === 'month' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-sm text-fumo">
                {t('reportFiscal.from')}
                <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className={inputClass} />
              </label>
              <label className="flex items-center gap-2 text-sm text-fumo">
                {t('reportFiscal.to')}
                <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className={inputClass} />
              </label>
            </div>
          )}

          {rangeTooLarge && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('reportFiscal.rangeTooLarge', { max: MAX_FISCAL_RANGE_DAYS, defaultValue: 'Intervallo massimo {{max}} giorni. Restringi il periodo.' })}
            </p>
          )}
        </div>

        {data && (
          <p className="text-xs text-fumo/80">
            {t('reportFiscal.transactionsMeta', { count: data.summary.transactionCount, period: periodMeta })}
            {data.restaurant.taxId && tRegime(t, taxRegion, 'taxIdMeta', { taxId: data.restaurant.taxId })}
            {isFetching && !isLoading && (
              <span className="ml-2 inline-flex items-center gap-1 text-aura-gold/80">
                <Loader2 className="h-3 w-3 animate-spin" />
              </span>
            )}
          </p>
        )}
      </section>

      <section className="aura-module-frame overflow-hidden">
        {(isLoading || isFetching) && !data?.rows?.length && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-fumo">
            <Loader2 className="h-8 w-8 animate-spin text-aura-gold" />
            <p className="text-sm font-medium">{t('reportFiscal.loading')}</p>
          </div>
        )}

        {isError && !isLoading && !rangeTooLarge && (
          <div className="flex flex-col items-center gap-3 py-16 text-rose-400">
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
              <div className="w-full max-w-full overflow-x-auto p-4 sm:p-0">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="glass-table-head">
                    <tr>
                      {tableHeaders.map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-fumo"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {pagedRows.map(row => (
                      <tr
                        key={row.orderId}
                        className="transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap text-fumo">
                          {row.fecha ? fmtDate(row.fecha) : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-fumo">
                            <Hash className="h-3 w-3 text-aura-gold" />
                            {row.orderId.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-fumo tabular-nums">{formatCurrency(row.baseImponible)}</td>
                        <td className="px-4 py-3.5 text-fumo tabular-nums">{formatCurrency(row.tax)}</td>
                        <td className="px-4 py-3.5 font-semibold text-pietra tabular-nums">
                          {formatCurrency(row.revenueAmount)}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-aura-gold tabular-nums">
                          {formatCurrency(row.tipAmount)}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-aura-gold-light tabular-nums">
                          {formatCurrency(row.total)}
                        </td>
                        {taxRegion === 'IT_MAIN' && (
                          <td className="px-4 py-3.5 text-fumo">
                            {(row as { paymentMethod?: string }).paymentMethod ?? '—'}
                          </td>
                        )}
                        {taxRegion !== 'IT_MAIN' && (
                          <td className="max-w-[120px] truncate px-4 py-3.5 font-mono text-[10px] text-fumo">
                            {(row as { fiscalIntegrityHash?: string | null }).fiscalIntegrityHash?.slice(0, 12) ?? '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.rows.length > FISCAL_ROW_PAGE_SIZE && (
                  <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
                    <button
                      type="button"
                      disabled={rowPage <= 1}
                      onClick={() => setRowPage(p => Math.max(1, p - 1))}
                      className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm text-fumo disabled:opacity-40"
                    >
                      {t('common.previous', { defaultValue: 'Precedente' })}
                    </button>
                    <span className="text-sm text-fumo">
                      {t('reportFiscal.pageOf', {
                        page: rowPage,
                        total: totalRowPages,
                        defaultValue: 'Pagina {{page}} di {{total}}',
                      })}
                    </span>
                    <button
                      type="button"
                      disabled={rowPage >= totalRowPages}
                      onClick={() => setRowPage(p => Math.min(totalRowPages, p + 1))}
                      className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-sm text-fumo disabled:opacity-40"
                    >
                      {t('common.next', { defaultValue: 'Successivo' })}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </ExecutivePageShell>
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
