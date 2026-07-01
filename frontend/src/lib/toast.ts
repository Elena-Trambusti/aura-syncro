/**
 * Micro-notifiche luxury — Sonner.
 * @see AuraSonner per lo stile visivo
 */
import { toast as sonnerToast, type ExternalToast } from 'sonner'
import { showAuraConfirm, type ConfirmToastOptions } from './confirmToast'

export type ToastOptions = ExternalToast

export const toast = Object.assign(sonnerToast, {
  /** Dialogo di conferma luxury centrato (portal dedicato). */
  confirm: (options: ConfirmToastOptions) => showAuraConfirm(options),

  kitchen: (message: string, options?: ToastOptions) =>
    sonnerToast(message, {
      duration: 4200,
      className: 'aura-sonner-toast--kitchen',
      ...options,
    }),

  ai: (message: string, options?: ToastOptions) =>
    sonnerToast(message, {
      duration: 5200,
      className: 'aura-sonner-toast--ai',
      ...options,
    }),

  aiCritical: (message: string, options?: ToastOptions) =>
    sonnerToast(message, {
      duration: 6500,
      className: 'aura-sonner-toast--ai-critical',
      ...options,
    }),

  aiOpportunity: (message: string, options?: ToastOptions) =>
    sonnerToast(message, {
      duration: 4800,
      className: 'aura-sonner-toast--ai-opportunity',
      ...options,
    }),

  notify: (
    message: string,
    variant: 'order' | 'reservation' | 'stock' | 'ready' = 'order',
    options?: ToastOptions,
  ) => {
    const className = {
      order: 'aura-sonner-toast--notify-order',
      reservation: 'aura-sonner-toast--notify-reservation',
      stock: 'aura-sonner-toast--notify-stock',
      ready: 'aura-sonner-toast--notify-ready',
    }[variant]
    return sonnerToast(message, { duration: 4000, className, ...options })
  },
})

export type { ExternalToast }
