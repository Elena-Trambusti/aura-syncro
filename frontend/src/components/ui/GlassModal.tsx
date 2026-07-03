import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AuraDialog } from './AuraDialog'
import type { AuraDialogMaxWidth } from './AuraDialog'

interface GlassModalProps {
  children: ReactNode
  onClose: () => void
  className?: string
  maxWidth?: AuraDialogMaxWidth
  /** Titolo accessibilità (sr-only) — obbligatorio per Radix Dialog */
  a11yTitle?: string
  a11yDescription?: string
}

/** Overlay + pannello vetro satin — modali premium luxury (Radix Dialog). */
export default function GlassModal({
  children,
  onClose,
  className,
  maxWidth = 'md',
  a11yTitle = 'Finestra di dialogo',
  a11yDescription,
}: GlassModalProps) {
  return (
    <AuraDialog
      onClose={onClose}
      maxWidth={maxWidth}
      variant="sheet"
      hideClose
      a11yTitle={a11yTitle}
      a11yDescription={a11yDescription}
      className={cn('p-6 sm:p-8', className)}
    >
      {children}
    </AuraDialog>
  )
}
