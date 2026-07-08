import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ui } from '../../lib/ui'

type AuraButtonVariant = 'primary' | 'ghost' | 'danger'

export interface AuraButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AuraButtonVariant
  /** Mostra spinner solo per azioni non ottimistiche (login, export, …) */
  loading?: boolean
  /** Azione ottimistica: nessuno spinner, feedback tap immediato */
  instant?: boolean
  children: ReactNode
}

const variantClass: Record<AuraButtonVariant, string> = {
  primary: ui.btnPrimary,
  ghost: ui.btnGhost,
  danger:
    'rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20',
}

const AuraButton = forwardRef<HTMLButtonElement, AuraButtonProps>(function AuraButton(
  {
    variant = 'primary',
    loading = false,
    instant = true,
    disabled,
    className,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const showSpinner = loading && !instant

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || showSpinner}
      className={cn(
        variantClass[variant],
        'inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {showSpinner ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
})

export default AuraButton
