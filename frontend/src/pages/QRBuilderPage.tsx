import { useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../contexts/AuthContext'
import { Download, ExternalLink, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

/** Contrasto massimo — standard tipografia / stampa */
const QR_FG = '#000000'
const QR_BG = '#FFFFFF'
const PREVIEW_SIZE = 320
/** Export ≥ 1000px per tipografia professionale */
const EXPORT_SIZE = 2048

export default function QRBuilderPage() {
  const { t } = useTranslation()
  const { restaurant } = useAuth()
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)

  const menuUrl = `${window.location.origin}/menu/${restaurant?.slug ?? ''}`

  /**
   * Download PNG ad alta risoluzione:
   * 1. Un canvas nascosto (2048×2048) viene renderizzato da qrcode.react con gli stessi
   *    parametri del QR visibile (URL, livello H, margini).
   * 2. canvas.toDataURL('image/png') serializza i pixel in base64.
   * 3. Un link <a download> temporaneo avvia il salvataggio sul filesystem locale.
   */
  const downloadPng = useCallback(() => {
    const canvas = exportCanvasRef.current
    if (!canvas || !restaurant?.slug) return

    const pngDataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `menu-qr-${restaurant.slug}.png`
    link.href = pngDataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t('qrBuilder.downloadSuccess'))
  }, [restaurant?.slug, t])

  const copyLink = () => {
    navigator.clipboard.writeText(menuUrl)
    toast.success(t('common.linkCopied'))
  }

  if (!restaurant?.slug) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-6">
      <header className="mb-8 w-full text-center">
        <h1 className="text-2xl font-bold text-slate-900">{t('qrBuilder.title')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('qrBuilder.subtitle')}</p>
      </header>

      <div className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center">
          {/* Anteprima grande — rigorosamente bianco e nero */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <QRCodeCanvas
              value={menuUrl}
              size={PREVIEW_SIZE}
              level="H"
              includeMargin
              bgColor={QR_BG}
              fgColor={QR_FG}
            />
          </div>

          {/* URL esplicito sotto il QR */}
          <div className="mt-8 w-full text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('qrBuilder.scanTarget')}
            </p>
            <p className="break-all font-mono text-sm font-medium leading-relaxed text-slate-900">
              {menuUrl}
            </p>
          </div>

          {/* Download primario */}
          <button
            type="button"
            onClick={downloadPng}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t('qrBuilder.downloadPng')}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            {t('qrBuilder.printHint')}
          </p>

          {/* Azioni secondarie */}
          <div className="mt-6 flex w-full flex-wrap justify-center gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => window.open(menuUrl, '_blank')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t('qrBuilder.previewMenu')}
            </button>
            <span className="text-slate-300" aria-hidden>|</span>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {t('common.copyLink')}
            </button>
          </div>
        </div>
      </div>

      {/* Canvas nascosto ad alta risoluzione — usato solo per l'export PNG */}
      <div className="pointer-events-none fixed left-[-9999px] top-0 opacity-0" aria-hidden>
        <QRCodeCanvas
          ref={exportCanvasRef}
          value={menuUrl}
          size={EXPORT_SIZE}
          level="H"
          includeMargin
          bgColor={QR_BG}
          fgColor={QR_FG}
        />
      </div>
    </div>
  )
}
