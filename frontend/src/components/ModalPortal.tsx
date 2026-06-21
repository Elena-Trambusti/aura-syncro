import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

interface ModalPortalProps {
  children: ReactNode
  onClose?: () => void
  overlayClassName?: string
}

/** Renders modal overlay in document.body so fixed positioning is not clipped by scroll containers. */
export default function ModalPortal({ children, onClose, overlayClassName }: ModalPortalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div
      data-portal-root
      className={cn(
        'saas-overlay flex items-end sm:items-center justify-center p-0 sm:p-4',
        overlayClassName,
      )}
      onClick={onClose}
    >
      {children}
    </div>,
    document.body,
  )
}
