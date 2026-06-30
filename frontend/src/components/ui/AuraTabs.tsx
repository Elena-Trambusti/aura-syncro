import type { ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export function AuraTabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className={className}>
      {children}
    </Tabs.Root>
  )
}

export function AuraTabsList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <Tabs.List className={cn('aura-tabs-list', className)}>
      {children}
    </Tabs.List>
  )
}

export function AuraTabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  return (
    <Tabs.Trigger value={value} className={cn('aura-tabs-trigger', className)}>
      {children}
    </Tabs.Trigger>
  )
}

export function AuraTabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: ReactNode
  className?: string
}) {
  return (
    <Tabs.Content value={value} className={cn('aura-tabs-content', className)}>
      {children}
    </Tabs.Content>
  )
}
