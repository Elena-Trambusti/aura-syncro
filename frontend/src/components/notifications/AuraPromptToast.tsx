import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { BRAND_LOGO_DISPLAY_SRC } from '../../lib/brand'

export interface AuraPromptToastProps {
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: (value: string) => void
  onCancel: () => void
  validate?: (value: string) => string | null
}

export default function AuraPromptToast({
  title,
  description,
  defaultValue = '',
  placeholder,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  validate,
}: AuraPromptToastProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (validate) {
      const validationError = validate(trimmed)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    onConfirm(trimmed)
  }

  return (
    <div
      className="aura-confirm-root fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aura-prompt-title"
      aria-describedby={description ? 'aura-prompt-desc' : undefined}
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
        <img src={BRAND_LOGO_DISPLAY_SRC} alt="" className="aura-confirm-brand" aria-hidden />

        <h2
          id="aura-prompt-title"
          className="font-display text-xl font-medium tracking-tight text-[#F4F0E6]"
        >
          {title}
        </h2>
        {description ? (
          <p id="aura-prompt-desc" className="mt-3 text-sm leading-relaxed text-slate-300">
            {description}
          </p>
        ) : null}

        <div className="mt-5">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
            placeholder={placeholder}
            className={cn(
              'w-full rounded-xl border bg-[#0B0E14] px-4 py-3 text-sm text-[#F4F0E6] placeholder:text-slate-500',
              'border-[#D4AF37]/25 focus:border-[#D4AF37]/55 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20',
              error && 'border-rose-400/50 focus:border-rose-400/60 focus:ring-rose-400/15',
            )}
          />
          {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        </div>

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
            onClick={submit}
            className={cn(
              'rounded-xl border border-aura-gold/45 bg-[#0B0E14] px-5 py-2.5 text-sm font-semibold text-aura-gold',
              'shadow-[0_0_20px_rgba(197,160,89,0.15)] transition-all hover:border-aura-gold/65 hover:bg-[#12151C] hover:shadow-[0_0_28px_rgba(197,160,89,0.22)]',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
