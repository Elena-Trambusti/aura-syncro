import { useRef, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../contexts/AuthContext'
import { Download, ExternalLink, Copy, BookOpen, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '../lib/utils'
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
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<QrMode>('menu')
  const [tableNumber, setTableNumber] = useState('')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const slug = restaurant?.slug ?? ''
  const baseMenuUrl = `${origin}/menu/${slug}`
  const parsedTable = tableNumber.trim() ? Number.parseInt(tableNumber, 10) : NaN
  const menuUrl = Number.isFinite(parsedTable) && parsedTable > 0
    ? `${baseMenuUrl}?tavolo=${parsedTable}`
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
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-fumo">
              {t('qrBuilder.tableNumberOptional')}
            </label>
            <input
              type="number"
              min={1}
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              placeholder={t('qrBuilder.tableNumberPlaceholder')}
              className="w-full rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm focus:border-aura-gold/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <p className="mt-1.5 text-xs text-fumo">{t('qrBuilder.tableNumberHint')}</p>
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="rounded-lg premium-card p-4">
            <QRCodeCanvas
              value={activeUrl}
              size={PREVIEW_SIZE}
              level="H"
              includeMargin
              bgColor={QR_BG}
              fgColor={QR_FG}
            />
          </div>

          <div className="mt-8 w-full text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fumo">
              {t('qrBuilder.scanTarget')}
            </p>
            <p className="break-all font-mono text-sm font-medium leading-relaxed text-pietra">
              {activeUrl}
            </p>
          </div>

          <button
            type="button"
            onClick={downloadPng}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t('qrBuilder.downloadPng')}
          </button>

          <p className="mt-4 text-center text-xs text-fumo">{t('qrBuilder.printHint')}</p>

          <div className="mt-6 flex w-full flex-wrap justify-center gap-3 border-t border-white/[0.06] pt-6">
            <button
              type="button"
              onClick={() => window.open(activeUrl, '_blank')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-fumo transition-colors hover:text-pietra"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {mode === 'menu' ? t('qrBuilder.previewMenu') : t('qrBuilder.previewBooking')}
            </button>
            <span className="text-slate-300" aria-hidden>|</span>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-fumo transition-colors hover:text-pietra"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {t('common.copyLink')}
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed left-[-9999px] top-0 opacity-0" aria-hidden>
        <QRCodeCanvas
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
