import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ExecutivePageShellProps {
  children: ReactNode
  className?: string
}

/** Wrapper pagina dashboard — spacing per sezione (stili nativi mobile via DashboardLayout) */
export default function ExecutivePageShell({ children, className }: ExecutivePageShellProps) {
  return (
    <div className={cn('space-y-4 sm:space-y-6', className)}>
      {children}
    </div>
  )
}
