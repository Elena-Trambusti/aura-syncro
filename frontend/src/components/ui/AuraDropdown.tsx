import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export const AuraDropdown = DropdownMenu.Root
export const AuraDropdownTrigger = DropdownMenu.Trigger
export const AuraDropdownGroup = DropdownMenu.Group
export const AuraDropdownSeparator = DropdownMenu.Separator

export function AuraDropdownContent({
  children,
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('aura-dropdown-content', className)}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export function AuraDropdownItem({
  children,
  className,
  inset,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item> & { inset?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn('aura-dropdown-item', inset && 'pl-8', className)}
      {...props}
    >
      {children}
    </DropdownMenu.Item>
  )
}

export function AuraDropdownLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <DropdownMenu.Label className={cn('aura-dropdown-label', className)}>
      {children}
    </DropdownMenu.Label>
  )
}
