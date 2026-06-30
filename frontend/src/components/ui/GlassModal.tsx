import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AuraDialog } from './AuraDialog'
import type { AuraDialogMaxWidth } from './AuraDialog'

interface GlassModalProps {
  children: ReactNode
  onClose: () => void
  className?: string
  maxWidth?: AuraDialogMaxWidth
}

/** Overlay + pannello vetro satin — modali premium luxury (Radix Dialog). */
export default function GlassModal({
  children,
  onClose,
  className,
  maxWidth = 'md',
}: GlassModalProps) {
  return (
    <AuraDialog
      onClose={onClose}
      maxWidth={maxWidth}
      variant="sheet"
      hideClose
      className={cn('p-6 sm:p-8', className)}
    >
      {children}
    </AuraDialog>
  )
}
