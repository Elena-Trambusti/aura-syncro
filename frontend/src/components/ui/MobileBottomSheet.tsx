import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface MobileBottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  /** id univoco per aria-labelledby */
  titleId?: string
}

/**
 * Bottom sheet mobile — portal su document.body con layout flex (no translateX).
 * Evita conflitti Radix/CSS su WebView Android.
 */
export default function MobileBottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  titleId = 'mobile-bottom-sheet-title',
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="mobile-bottom-sheet-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="mobile-bottom-sheet-overlay"
        onClick={onClose}
        tabIndex={-1}
        aria-label="Close overlay"
      />
      <div className={cn('mobile-bottom-sheet-panel', className)}>
        <div className="mobile-bottom-sheet-handle" aria-hidden />
        <header className="mobile-bottom-sheet-header">
          <h2 id={titleId} className="mobile-bottom-sheet-title">
            {title}
          </h2>
          {description && (
            <p className="mobile-bottom-sheet-description">{description}</p>
          )}
        </header>
        <div className="mobile-bottom-sheet-body">{children}</div>
        {footer ? <footer className="mobile-bottom-sheet-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
