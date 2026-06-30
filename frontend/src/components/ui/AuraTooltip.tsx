import type { ReactNode } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export function AuraTooltipProvider({
  children,
  delayDuration = 200,
}: {
  children: ReactNode
  delayDuration?: number
}) {
  return (
    <Tooltip.Provider delayDuration={delayDuration}>
      {children}
    </Tooltip.Provider>
  )
}

export function AuraTooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
  className,
  contentClassName,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
  contentClassName?: string
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild className={className}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          align={align}
          sideOffset={8}
          className={cn('aura-tooltip-content', contentClassName)}
        >
          {content}
          <Tooltip.Arrow className="aura-tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
