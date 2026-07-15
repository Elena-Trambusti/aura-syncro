import { useRef, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import AuraQrCanvas from '../components/qr/AuraQrCanvas'
import { useAuth, useTenantQueryKey } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { tq } from '../lib/queryKeys'
import { Download, ExternalLink, Copy, BookOpen, CalendarDays } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '../lib/utils'
import { openPublicPreviewOrNotify } from '../lib/openPublicPreview'
import ExecutivePageShell from '../components/layout/ExecutivePageShell'
import ExecutivePageHeader from '../components/layout/ExecutivePageHeader'
import PageSkeleton from '../components/ui/PageSkeleton'
import EmptyState from '../components/ui/EmptyState'

const QR_FG = '#000000'
const QR_BG = '#FFFFFF'
const PREVIEW_SIZE = 280
const EXPORT_SIZE = 2048

type QrMode = 'menu' | 'booking'

export default function QRBuilderPage() {
  const { t } = useTranslation()
  const { restaurant, isLoading } = useAuth()
  const tk = useTenantQueryKey()
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<QrMode>('menu')
  const [tableNumber, setTableNumber] = useState('')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const slug = restaurant?.slug ?? ''
  const baseMenuUrl = `${origin}/menu/${slug}`
  const parsedTable = tableNumber.trim() ? Number.parseInt(tableNumber, 10) : NaN
  const hasValidTable = Number.isFinite(parsedTable) && parsedTable > 0

  const { data: qrTokenData } = useQuery({
    queryKey: tq(tk, 'table-qr-token', parsedTable),
    queryFn: () => api.get(`/tables/${parsedTable}/qr-token`).then(r => r.data as { token: string }),
    enabled: hasValidTable,
    staleTime: 60 * 60 * 1000,
  })

  const menuUrl = hasValidTable && qrTokenData?.token
    ? `${baseMenuUrl}?tavolo=${parsedTable}&tok=${encodeURIComponent(qrTokenData.token)}`
    : baseMenuUrl
  const bookingUrl = `${origin}/prenota/${slug}`
  const activeUrl = mode === 'menu' ? menuUrl : bookingUrl

  const downloadPng = useCallback(() => {
    const canvas = exportCanvasRef.current
    if (!canvas || !slug) return

    const pngDataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    const suffix = mode === 'booking'
      ? '-prenotazioni'
      : Number.isFinite(parsedTable) && parsedTable > 0
        ? `-tavolo-${parsedTable}`
        : ''
    link.download = `aura-${mode}-qr-${slug}${suffix}.png`
    link.href = pngDataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t('qrBuilder.downloadSuccess'))
  }, [slug, mode, parsedTable, t])

  const copyLink = () => {
    navigator.clipboard.writeText(activeUrl)
    toast.success(t('common.linkCopied'))
  }

  if (isLoading) {
    return (
      <ExecutivePageShell className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-6">
        <ExecutivePageHeader title={t('qrBuilder.title')} subtitle={t('qrBuilder.subtitle')} />
        <PageSkeleton variant="cards" count={1} className="w-full" />
      </ExecutivePageShell>
    )
  }

  if (!slug) {
    return (
      <ExecutivePageShell className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-6">
        <EmptyState
          icon={BookOpen}
          title={t('qrBuilder.slugMissing')}
          action={(
            <Link
              to="/impostazioni"
              className="inline-flex items-center gap-2 rounded-xl bg-aura-gold px-5 py-2.5 text-sm font-semibold text-white hover:bg-aura-gold-light transition-colors"
            >
              {t('qrBuilder.goToSettings')}
            </Link>
          )}
        />
      </ExecutivePageShell>
    )
  }

  return (
    <ExecutivePageShell className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-6">
      <ExecutivePageHeader
        title={t('qrBuilder.title')}
        subtitle={t('qrBuilder.subtitle')}
        className="mb-6 w-full text-center [&_.aura-page-title]:text-center [&_.aura-page-subtitle]:text-center"
      />

      <div className="mb-6 flex w-full rounded-xl premium-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMode('menu')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
            mode === 'menu' ? 'bg-aura-gold text-navy font-semibold' : 'text-fumo hover:bg-white/[0.05]',
          )}
        >
          <BookOpen className="h-4 w-4" />
          {t('qrBuilder.modeMenu')}
        </button>
        <button
          type="button"
          onClick={() => setMode('booking')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
            mode === 'booking' ? 'bg-aura-gold text-navy font-semibold' : 'text-fumo hover:bg-white/[0.05]',
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {t('qrBuilder.modeBooking')}
        </button>
      </div>

      <div className="w-full rounded-xl premium-card p-8 shadow-sm">
        <p className="mb-4 text-sm text-fumo">
          {mode === 'menu' ? t('qrBuilder.menuModeDesc') : t('qrBuilder.bookingModeDesc')}
        </p>

        {mode === 'menu' && (
          <div className="mb-6 w-full">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-fumo">
              {t('qrBuilder.tableNumberOptional')}
            </label>
            <input
              type="number"
              min={1}
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              placeholder={t('qrBuilder.tableNumberPlaceholder')}
              className="w-full rounded-xl border border-white/[0.1] bg-navy-mid px-4 py-3 text-sm text-pietra transition-colors focus:border-aura-gold focus:bg-navy-elevated focus:outline-none focus:ring-1 focus:ring-aura-gold shadow-inner"
            />
            <p className="mt-2 text-xs text-fumo/70">{t('qrBuilder.tableNumberHint')}</p>
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="rounded-2xl border border-aura-gold/30 bg-navy-elevated/80 p-6 shadow-[0_0_40px_rgba(212,175,55,0.15)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_50px_rgba(212,175,55,0.25)] relative group cursor-crosshair">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aura-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <AuraQrCanvas
              value={activeUrl}
              size={PREVIEW_SIZE}
              level="H"
              includeMargin
              bgColor={QR_BG}
              fgColor={QR_FG}
              className="rounded-lg shadow-inner"
            />
          </div>

          <div className="mt-6 w-full text-center">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-aura-gold">
              {t('qrBuilder.scanTarget')}
            </p>
            <p className="break-all font-mono text-sm font-medium leading-relaxed text-pietra bg-navy-mid rounded-xl p-3 border border-white/[0.04]">
              {activeUrl}
            </p>
          </div>

          <div className="mt-4 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openPublicPreviewOrNotify(activeUrl)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-aura-gold/40 bg-aura-gold/10 px-4 py-3.5 text-sm font-semibold text-aura-gold transition-colors hover:bg-aura-gold/20 active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              {mode === 'menu' ? t('qrBuilder.previewMenu') : t('qrBuilder.previewBooking')}
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-navy-mid px-4 py-3.5 text-sm font-semibold text-pietra transition-colors hover:bg-white/[0.05] active:scale-[0.98]"
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              {t('common.copyLink')}
            </button>
          </div>

          <button
            type="button"
            onClick={downloadPng}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aura-gold to-amber-400 px-6 py-4 text-sm font-bold uppercase tracking-wider text-navy shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t('qrBuilder.downloadPng')}
          </button>

          <p className="mt-4 text-center text-xs text-fumo">{t('qrBuilder.printHint')}</p>
        </div>
      </div>

      <div className="pointer-events-none fixed left-[-9999px] top-0 opacity-0" aria-hidden>
        <AuraQrCanvas
          ref={exportCanvasRef}
          value={activeUrl}
          size={EXPORT_SIZE}
          level="H"
          includeMargin
          bgColor={QR_BG}
          fgColor={QR_FG}
        />
      </div>
    </ExecutivePageShell>
  )
}
