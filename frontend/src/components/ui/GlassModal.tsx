import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { ui } from '../../lib/ui'
import ModalPortal from '../ModalPortal'

interface GlassModalProps {
  children: ReactNode
  onClose: () => void
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg'
}

const MAX_W = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const

/** Overlay + pannello vetro satin — modali premium luxury. */
export default function GlassModal({
  children,
  onClose,
  className,
  maxWidth = 'md',
}: GlassModalProps) {
  return (
    <ModalPortal onClose={onClose}>
      <div
        className={cn('w-full', MAX_W[maxWidth], ui.glassModal, 'p-6 sm:p-8', className)}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </ModalPortal>
  )
}
