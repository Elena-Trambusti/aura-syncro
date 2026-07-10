import i18n from '../i18n'
import { toast } from '@/lib/toast'
import { isStandaloneApp } from './standaloneApp'

/**
 * Apre menu/prenotazioni pubblici.
 * In PWA/APK non naviga mai nella stessa finestra (niente tasto indietro).
 */
export function openPublicPreview(url: string): boolean {
  const popup = window.open(url, '_blank', 'noopener,noreferrer')
  if (popup) {
    try {
      popup.opener = null
    } catch {
      /* ignore */
    }
    return true
  }

  if (isStandaloneApp()) {
    return false
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

/** Apre l'anteprima; se il WebView blocca le nuove schede, copia il link e avvisa. */
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
