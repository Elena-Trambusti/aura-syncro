import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import AuraConfirmToast, {
  type AuraConfirmToastProps,
  type AuraConfirmVariant,
} from '../components/notifications/AuraConfirmToast'

export interface ConfirmToastOptions {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  variant?: AuraConfirmVariant
  badge?: string | number
  eyebrow?: string
}

const CONFIRM_PORTAL_ID = 'aura-confirm-portal'

let confirmContainer: HTMLDivElement | null = null
let confirmRoot: Root | null = null

function ensureConfirmRoot(): Root {
  if (!confirmContainer || !confirmRoot) {
    confirmContainer = document.getElementById(CONFIRM_PORTAL_ID) as HTMLDivElement | null
    if (!confirmContainer) {
      confirmContainer = document.createElement('div')
      confirmContainer.id = CONFIRM_PORTAL_ID
      document.body.appendChild(confirmContainer)
    }
    confirmRoot = createRoot(confirmContainer)
  }
  return confirmRoot
}

function unmountConfirm() {
  confirmRoot?.render(null)
}

/** Conferma luxury a schermo intero — portal su body (non nel toaster Sonner). */
export function showAuraConfirm(options: ConfirmToastOptions): Promise<boolean> {
  return new Promise(resolve => {
    const root = ensureConfirmRoot()
    root.render(
      createElement(AuraConfirmToast, {
        ...options,
        onConfirm: () => {
          unmountConfirm()
          resolve(true)
        },
        onCancel: () => {
          unmountConfirm()
          resolve(false)
        },
      } satisfies AuraConfirmToastProps),
    )
  })
}
