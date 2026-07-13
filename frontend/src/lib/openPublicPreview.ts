import i18n from '../i18n'
import { toast } from '@/lib/toast'
import { isStandaloneApp } from './standaloneApp'

function sameOriginPath(url: string): string | null {
  try {
    const target = new URL(url, window.location.origin)
    if (target.origin !== window.location.origin) return null
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return null
  }
}

/**
 * Apre menu/prenotazioni pubblici.
 * In APK/TWA: navigazione in-app (stesso WebView) + pulsante "Torna all'app" sulle pagine pubbliche.
 */
export function openPublicPreview(url: string): boolean {
  const internalPath = sameOriginPath(url)
  if (internalPath) {
    window.location.assign(internalPath)
    return true
  }

  if (isStandaloneApp()) {
    try {
      window.location.assign(url)
      return true
    } catch {
      return false
    }
  }

  const popup = window.open(url, '_blank', 'noopener,noreferrer')
  if (popup) {
    try {
      popup.opener = null
    } catch {
      /* ignore */
    }
    return true
  }

  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}

/** Apre l'anteprima; se non possibile copia il link negli appunti. */
export function openPublicPreviewOrNotify(url: string): void {
  if (openPublicPreview(url)) return

  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(url).then(() => {
      toast.info(i18n.t('qrBuilder.previewOpenFailed'))
    })
    return
  }

  toast.error(i18n.t('qrBuilder.previewOpenFailed'))
}
