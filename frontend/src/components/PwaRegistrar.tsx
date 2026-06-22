import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'

/**
 * Registra il Service Worker senza ricaricare la pagina automaticamente.
 * Mostra un toast solo quando c'è un aggiornamento da applicare.
 */
export default function PwaRegistrar() {
  const { t } = useTranslation()

  useEffect(() => {
    if (!import.meta.env.PROD) return

    const updateSW = registerSW({
      immediate: true,
      onRegistered(registration) {
        console.info('[Aura Syncro PWA] Service Worker registrato:', registration?.scope)
      },
      onRegisterError(error) {
        console.error('[Aura Syncro PWA] Errore registrazione Service Worker:', error)
      },
      onNeedRefresh() {
        toast(
          (toastInstance) => (
            <div className="flex max-w-xs flex-col gap-2 sm:max-w-sm">
              <p className="text-sm font-medium text-slate-100">{t('pwa.updateAvailable')}</p>
              <button
                type="button"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
                onClick={() => {
                  toast.dismiss(toastInstance.id)
                  void updateSW(true)
                }}
              >
                {t('pwa.updateRefresh')}
              </button>
            </div>
          ),
          { id: 'pwa-update', duration: Infinity },
        )
      },
    })
  }, [t])

  return null
}
