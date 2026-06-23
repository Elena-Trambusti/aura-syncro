import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ExecutivePageShellProps {
  children: ReactNode
  className?: string
}

/** Wrapper pagina dashboard — spacing, animazione entrata, mobile-first */
export default function ExecutivePageShell({ children, className }: ExecutivePageShellProps) {
  return (
    <div className={cn('pwa-mobile-page aura-page-enter', className)}>
      {children}
    </div>
  )
}
