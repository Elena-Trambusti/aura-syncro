import { Suspense, type ReactNode } from 'react'

interface ChartSuspenseProps {
  children: ReactNode
  height?: number
  className?: string
}

export default function ChartSuspense({ children, height = 240, className }: ChartSuspenseProps) {
  return (
    <Suspense
      fallback={(
        <div
          className={className ?? 'w-full animate-pulse rounded-lg bg-white/[0.03]'}
          style={{ height }}
          aria-hidden
        />
      )}
    >
      {children}
    </Suspense>
  )
}
