import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ui } from '@/lib/ui'

const MAX_W = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
} as const

export type AuraDialogMaxWidth = keyof typeof MAX_W
export type AuraDialogVariant = 'default' | 'sheet' | 'fullscreen'

export interface AuraDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onClose: () => void
  children: ReactNode
  className?: string
  overlayClassName?: string
  maxWidth?: AuraDialogMaxWidth
  variant?: AuraDialogVariant
  /** Nasconde il pulsante X automatico nell'header */
  hideClose?: boolean
  /** Titolo per screen reader (sr-only) se i figli non usano AuraDialogTitle */
  a11yTitle?: string
  a11yDescription?: string
  /** Imposta true se i figli includono già Dialog.Title / Dialog.Description */
  skipBuiltInA11y?: boolean
}

export function AuraDialog({
  open = true,
  onOpenChange,
  onClose,
  children,
  className,
  overlayClassName,
  maxWidth = 'md',
  variant = 'default',
  hideClose = false,
  a11yTitle = 'Dialog',
  a11yDescription,
  skipBuiltInA11y = false,
}: AuraDialogProps) {
  const handleOpenChange = (next: boolean) => {
    onOpenChange?.(next)
    if (!next) onClose()
  }

  const contentClass =
    variant === 'fullscreen'
      ? cn(
          'aura-dialog-content aura-dialog-content--fullscreen',
          'flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none bg-navy-elevated p-0',
          'lg:h-[85dvh] lg:max-h-[85dvh] lg:rounded-xl',
          className,
        )
      : variant === 'sheet'
        ? cn(
            'aura-dialog-content aura-dialog-content--sheet',
            'w-full',
            MAX_W[maxWidth],
            ui.glassModal,
            'rounded-t-2xl p-6 sm:rounded-2xl sm:p-8',
            className,
          )
        : cn(
            'aura-dialog-content',
            'w-full',
            MAX_W[maxWidth],
            ui.glassModal,
            'rounded-t-2xl p-6 sm:rounded-2xl sm:p-8',
            className,
          )

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'aura-dialog-overlay',
            variant === 'fullscreen' && 'aura-dialog-overlay--fullscreen',
            overlayClassName,
          )}
        />
        <Dialog.Content
          className={contentClass}
          onClick={e => e.stopPropagation()}
          onOpenAutoFocus={e => variant === 'fullscreen' && e.preventDefault()}
        >
          {!hideClose && variant !== 'fullscreen' && (
            <Dialog.Close asChild>
              <button
                type="button"
                className="aura-dialog-close"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          )}
          {!skipBuiltInA11y && (
            <>
              <Dialog.Title className="sr-only">{a11yTitle}</Dialog.Title>
              <Dialog.Description className="sr-only">
                {a11yDescription ?? a11yTitle}
              </Dialog.Description>
            </>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AuraDialogHeader({
  children,
  className,
  onClose,
  title,
  description,
}: {
  children?: ReactNode
  className?: string
  onClose?: () => void
  title?: string
  description?: string
}) {
  if (children) {
    return <div className={cn('aura-dialog-header', className)}>{children}</div>
  }
  return (
    <div className={cn('aura-dialog-header', className)}>
      <div className="min-w-0 flex-1 pr-8">
        {title && (
          <Dialog.Title className="aura-dialog-title">{title}</Dialog.Title>
        )}
        {description && (
          <Dialog.Description className="aura-dialog-description">{description}</Dialog.Description>
        )}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="aura-dialog-close aura-dialog-close--inline">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function AuraDialogTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog.Title className={cn('aura-dialog-title', className)}>
      {children}
    </Dialog.Title>
  )
}

export function AuraDialogDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog.Description className={cn('aura-dialog-description', className)}>
      {children}
    </Dialog.Description>
  )
}

export function AuraDialogBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('aura-dialog-body', className)}>{children}</div>
}

export function AuraDialogFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('aura-dialog-footer', className)}>{children}</div>
}
