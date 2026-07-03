import { cn } from '@/lib/utils'

import { BRAND_LOGO_SRC } from '../../lib/brand'

export type AuraConfirmVariant = 'default' | 'cleaning' | 'danger'

export interface AuraConfirmToastProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  variant?: AuraConfirmVariant
  /** Numero tavolo o etichetta nel medaglione (es. 2 → "T2") */
  badge?: string | number
  /** Riga sopra il titolo (es. "Pulizia") */
  eyebrow?: string
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT_STYLES: Record<
  AuraConfirmVariant,
  { confirmBtn: string }
> = {
  default: {
    confirmBtn:
      'border-aura-gold/45 text-aura-gold shadow-[0_0_20px_rgba(197,160,89,0.15)] hover:border-aura-gold/65 hover:shadow-[0_0_28px_rgba(197,160,89,0.22)]',
  },
  cleaning: {
    confirmBtn:
      'border-[#C5A059]/45 text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.15)] hover:border-[#C5A059]/65 hover:shadow-[0_0_28px_rgba(197,160,89,0.22)]',
  },
  danger: {
    confirmBtn:
      'border-rose-400/45 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.12)] hover:border-rose-400/65 hover:shadow-[0_0_28px_rgba(244,63,94,0.18)]',
  },
}

function formatBadge(badge: string | number): string {
  const raw = String(badge).trim()
  if (/^t\d+$/i.test(raw)) return raw.toUpperCase()
  return `T${raw}`
}

export default function AuraConfirmToast({
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  badge,
  eyebrow,
  onConfirm,
  onCancel,
}: AuraConfirmToastProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <div
      className="aura-confirm-root fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="aura-confirm-title"
      aria-describedby="aura-confirm-desc"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-[aura-overlay-in_200ms_ease-out]"
        onClick={onCancel}
        aria-label={cancelLabel}
      />
      <div
        className={cn(
          'aura-confirm-card relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.08] bg-neutral-950/96 p-6 sm:p-8',
        )}
      >
        <div className="aura-confirm-card__accent" aria-hidden />

        {badge != null ? (
          <div
            className={cn(
              'aura-confirm-medallion',
              variant === 'cleaning' && 'aura-confirm-medallion--cleaning',
            )}
            aria-hidden
          >
            <span className="aura-confirm-medallion__label">{formatBadge(badge)}</span>
          </div>
        ) : (
          <img src={BRAND_LOGO_SRC} alt="" className="aura-confirm-brand" aria-hidden />
        )}

        {eyebrow ? (
          <p className="aura-confirm-eyebrow">{eyebrow}</p>
        ) : null}

        <h2
          id="aura-confirm-title"
          className="font-display text-xl font-medium tracking-tight text-[#F4F0E6]"
        >
          {title}
        </h2>
        <p id="aura-confirm-desc" className="mt-3 text-sm leading-relaxed text-slate-300">
          {description}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'rounded-xl border bg-[#0B0E14] px-5 py-2.5 text-sm font-semibold transition-all hover:bg-[#12151C]',
              styles.confirmBtn,
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
